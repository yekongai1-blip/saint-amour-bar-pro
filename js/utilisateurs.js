"use strict";

/* ==========================================
   SAINT-AMOUR BAR PRO
   Utilisateurs locaux + Supabase Auth
   ========================================== */

(function () {
    const TABLE = "utilisateurs";
    const SESSION_KEY = "saintAmourBarProSession";
    const MODE_KEY = "saintAmourBarProMode";

    let utilisateurConnecte = null;
    let modeConnexion = "local";

    const ROLES = {
        directeur: [
            "accueil", "ventes", "produits", "stock",
            "caisse", "depenses", "dettes", "rapports",
            "parametres", "sauvegarde", "utilisateurs",
            "synchronisation"
        ],
        caissier: ["accueil", "ventes", "caisse"],
        stock: ["accueil", "produits", "stock"]
    };

    function normaliserIdentifiant(valeur) {
        return String(valeur || "").trim().toLowerCase();
    }

    function obtenirSession() {
        try {
            return JSON.parse(
                sessionStorage.getItem(SESSION_KEY) || "null"
            );
        } catch (_) {
            return null;
        }
    }

    function estConnecte() {
        return Boolean(
            utilisateurConnecte &&
            utilisateurConnecte.id &&
            ROLES[utilisateurConnecte.role]
        );
    }

    function aAcces(page) {
        if (!estConnecte()) return false;

        return (ROLES[utilisateurConnecte.role] || [])
            .includes(page);
    }

    function obtenirUtilisateurConnecte() {
        if (!utilisateurConnecte) return null;

        return {
            id: utilisateurConnecte.id,
            identifiant: utilisateurConnecte.identifiant,
            nom: utilisateurConnecte.nom,
            role: utilisateurConnecte.role,
            mode: modeConnexion
        };
    }

    function enregistrerSession(utilisateur, mode) {
        if (
            !utilisateur ||
            !utilisateur.id ||
            !ROLES[utilisateur.role]
        ) {
            throw new Error("Utilisateur ou rôle non autorisé.");
        }

        utilisateurConnecte = {
            id: utilisateur.id,
            identifiant: utilisateur.identifiant,
            nom: utilisateur.nom,
            role: utilisateur.role
        };

        modeConnexion = mode;

        sessionStorage.setItem(
            SESSION_KEY,
            JSON.stringify(utilisateurConnecte)
        );

        sessionStorage.setItem(MODE_KEY, mode);
    }

    async function hacherMotDePasse(motDePasse, selHex) {
        if (!window.crypto || !crypto.subtle) {
            throw new Error(
                "Web Crypto est indisponible. Ouvre l'application " +
                "dans un contexte sécurisé."
            );
        }

        const sel = selHex
            ? Uint8Array.from(
                selHex.match(/.{1,2}/g).map(
                    octet => parseInt(octet, 16)
                )
            )
            : crypto.getRandomValues(new Uint8Array(16));

        const cle = await crypto.subtle.importKey(
            "raw",
            new TextEncoder().encode(motDePasse),
            "PBKDF2",
            false,
            ["deriveBits"]
        );

        const bits = await crypto.subtle.deriveBits({
            name: "PBKDF2",
            salt: sel,
            iterations: 310000,
            hash: "SHA-256"
        }, cle, 256);

        return {
            sel: Array.from(sel)
                .map(v => v.toString(16).padStart(2, "0"))
                .join(""),
            empreinte: Array.from(new Uint8Array(bits))
                .map(v => v.toString(16).padStart(2, "0"))
                .join("")
        };
    }

    async function listerUtilisateurs() {
        const liste = await lireTous(TABLE);
        return Array.isArray(liste) ? liste : [];
    }

    async function initialiserPremierDirecteur(
        nom,
        identifiant,
        motDePasse
    ) {
        const utilisateurs = await listerUtilisateurs();

        if (utilisateurs.length > 0) {
            throw new Error(
                "Un compte local existe déjà. " +
                "Connecte-toi avec un compte existant."
            );
        }

        nom = String(nom || "").trim();
        identifiant = normaliserIdentifiant(identifiant);
        motDePasse = String(motDePasse || "");

        if (nom.length < 2) {
            throw new Error("Saisis le nom du Directeur.");
        }

        if (!/^[a-z0-9._-]{3,40}$/.test(identifiant)) {
            throw new Error("Identifiant local invalide.");
        }

        if (motDePasse.length < 10) {
            throw new Error(
                "Le mot de passe doit contenir au moins 10 caractères."
            );
        }

        const resultat = await hacherMotDePasse(motDePasse);

        await ajouterEnregistrement(TABLE, {
            id: "directeur-initial",
            nom,
            identifiant,
            role: "directeur",
            sel: resultat.sel,
            empreinte: resultat.empreinte,
            dateCreation: new Date().toISOString(),
            actif: true
        });

        return true;
    }

    async function connecter(identifiant, motDePasse) {
        identifiant = normaliserIdentifiant(identifiant);
        motDePasse = String(motDePasse || "");

        const utilisateurs = await listerUtilisateurs();

        const utilisateur = utilisateurs.find(u =>
            normaliserIdentifiant(u.identifiant) === identifiant &&
            u.actif !== false
        );

        if (!utilisateur) {
            throw new Error("Identifiant ou mot de passe incorrect.");
        }

        const resultat = await hacherMotDePasse(
            motDePasse,
            utilisateur.sel
        );

        if (resultat.empreinte !== utilisateur.empreinte) {
            throw new Error("Identifiant ou mot de passe incorrect.");
        }

        enregistrerSession({
            id: utilisateur.id,
            identifiant: utilisateur.identifiant,
            nom: utilisateur.nom,
            role: utilisateur.role
        }, "local");

        return obtenirUtilisateurConnecte();
    }

    async function connecterAvecSupabase(identifiant, motDePasse) {
        if (typeof window.connecterSupabase !== "function") {
            throw new Error("Le module Supabase n'est pas chargé.");
        }

        const profil = await window.connecterSupabase(
            identifiant,
            motDePasse
        );

        enregistrerSession({
            id: profil.uid,
            identifiant: profil.identifiant || profil.email || identifiant,
            nom: profil.nom,
            role: profil.role
        }, "supabase");

        return obtenirUtilisateurConnecte();
    }

    async function restaurerSession() {
        const session = obtenirSession();
        const mode = sessionStorage.getItem(MODE_KEY) || "local";

        if (!session || !session.id) {
            utilisateurConnecte = null;
            return false;
        }

        if (mode === "supabase") {
            if (
                typeof window.restaurerSessionSupabase !== "function"
            ) {
                utilisateurConnecte = null;
                return false;
            }

            try {
                const profil = await window.restaurerSessionSupabase();

                if (!profil) {
                    sessionStorage.removeItem(SESSION_KEY);
                    sessionStorage.removeItem(MODE_KEY);
                    utilisateurConnecte = null;
                    return false;
                }

                enregistrerSession({
                    id: profil.uid,
                    identifiant: profil.identifiant || profil.email ||
                        session.identifiant,
                    nom: profil.nom,
                    role: profil.role
                }, "supabase");

                return true;
            } catch (erreur) {
                console.error(
                    "Restauration Supabase impossible :",
                    erreur
                );
                return false;
            }
        }

        const utilisateurs = await listerUtilisateurs();

        const utilisateur = utilisateurs.find(u =>
            u.id === session.id &&
            u.actif !== false
        );

        if (!utilisateur) {
            sessionStorage.removeItem(SESSION_KEY);
            sessionStorage.removeItem(MODE_KEY);
            utilisateurConnecte = null;
            return false;
        }

        enregistrerSession({
            id: utilisateur.id,
            identifiant: utilisateur.identifiant,
            nom: utilisateur.nom,
            role: utilisateur.role
        }, "local");

        return true;
    }

    async function deconnecter() {
        const mode = modeConnexion;

        utilisateurConnecte = null;
        modeConnexion = "local";

        sessionStorage.removeItem(SESSION_KEY);
        sessionStorage.removeItem(MODE_KEY);

        if (
            mode === "supabase" &&
            typeof window.deconnecterSupabase === "function"
        ) {
            await window.deconnecterSupabase();
        }
    }

    async function creerUtilisateur(
        nom,
        identifiant,
        motDePasse,
        role
    ) {
        if (!aAcces("utilisateurs")) {
            throw new Error(
                "Seul le Directeur peut gérer les utilisateurs."
            );
        }

        if (modeConnexion !== "supabase") {
            throw new Error(
                "Connecte-toi avec le compte Directeur Supabase."
            );
        }

        nom = String(nom || "").trim();
        identifiant = normaliserIdentifiant(identifiant);
        motDePasse = String(motDePasse || "");

        if (!["caissier", "stock"].includes(role)) {
            throw new Error(
                "Choisis le rôle Caissier ou Gestionnaire de stock."
            );
        }

        if (nom.length < 2) {
            throw new Error("Saisis le nom complet de l'employé.");
        }

        if (!/^[a-z0-9._-]{3,40}$/.test(identifiant)) {
            throw new Error("Identifiant invalide.");
        }

        if (motDePasse.length < 10) {
            throw new Error(
                "Le mot de passe doit contenir au moins 10 caractères."
            );
        }

        if (
            typeof window.creerUtilisateurSupabase !== "function"
        ) {
            throw new Error(
                "La fonction Supabase n'est pas disponible. " +
                "Vérifie js/supabase.js."
            );
        }

        return await window.creerUtilisateurSupabase(
            nom,
            identifiant,
            motDePasse,
            role
        );
    }

    async function afficherGestionUtilisateurs(conteneur) {
        if (!aAcces("utilisateurs")) {
            throw new Error("Accès réservé au Directeur.");
        }

        const zone = typeof conteneur === "string"
            ? document.getElementById(conteneur)
            : conteneur;

        if (!zone) {
            throw new Error("Zone d'affichage introuvable.");
        }

        const modeCloud = modeConnexion === "supabase";

        zone.innerHTML = `
            <h2>Gestion des utilisateurs</h2>
            <p>
                ${modeCloud
                    ? "Création des comptes employés dans Supabase."
                    : "Connecte-toi avec le compte Directeur Supabase pour créer des employés."}
            </p>

            <form id="formNouvelUtilisateur">
                <label for="nouvelUtilisateurNom">Nom complet</label>
                <input id="nouvelUtilisateurNom"
                       type="text" minlength="2"
                       autocomplete="name" required>

                <label for="nouvelUtilisateurIdentifiant">Identifiant</label>
                <input id="nouvelUtilisateurIdentifiant"
                       type="text" minlength="3" maxlength="40"
                       pattern="[A-Za-z0-9._-]{3,40}"
                       autocomplete="username" required>

                <label for="nouvelUtilisateurMotDePasse">Mot de passe</label>
                <input id="nouvelUtilisateurMotDePasse"
                       type="password" minlength="10"
                       autocomplete="new-password" required>

                <label for="nouvelUtilisateurRole">Rôle</label>
                <select id="nouvelUtilisateurRole" required>
                    <option value="caissier">Caissier</option>
                    <option value="stock">Gestionnaire de stock</option>
                </select>

                <button type="submit" ${modeCloud ? "" : "disabled"}>
                    Créer le compte employé
                </button>
            </form>

            <p id="messageUtilisateursBar"
               role="status" aria-live="polite"></p>

            <h3>Comptes locaux de cet appareil</h3>
            <div id="listeUtilisateursBar"></div>
        `;

        const liste = zone.querySelector("#listeUtilisateursBar");
        const message = zone.querySelector("#messageUtilisateursBar");
        const formulaire = zone.querySelector("#formNouvelUtilisateur");

        try {
            const utilisateurs = await listerUtilisateurs();

            if (!utilisateurs.length) {
                liste.textContent = "Aucun compte local enregistré.";
            } else {
                utilisateurs.forEach(u => {
                    const ligne = document.createElement("p");
                    ligne.textContent =
                        `${u.nom} — ${u.identifiant} — ${u.role}` +
                        (u.actif === false ? " — Désactivé" : "");
                    liste.appendChild(ligne);
                });
            }
        } catch (erreur) {
            liste.textContent =
                "Impossible de charger les comptes locaux : " +
                erreur.message;
        }

        formulaire.addEventListener("submit", async event => {
            event.preventDefault();

            const bouton = formulaire.querySelector(
                'button[type="submit"]'
            );

            if (!modeCloud) {
                message.textContent =
                    "Connecte-toi avec le compte Directeur Supabase.";
                return;
            }

            bouton.disabled = true;
            message.textContent = "Création du compte en cours…";

            try {
                await creerUtilisateur(
                    zone.querySelector("#nouvelUtilisateurNom").value,
                    zone.querySelector("#nouvelUtilisateurIdentifiant").value,
                    zone.querySelector("#nouvelUtilisateurMotDePasse").value,
                    zone.querySelector("#nouvelUtilisateurRole").value
                );

                message.textContent =
                    "Compte employé créé avec succès dans Supabase.";

                formulaire.reset();
            } catch (erreur) {
                message.textContent = erreur && erreur.message
                    ? erreur.message
                    : "Une erreur est survenue lors de la création.";
            } finally {
                bouton.disabled = false;
            }
        });
    }

    window.BarUtilisateurs = {
        initialiserPremierDirecteur,
        connecter,
        connecterAvecSupabase,
        deconnecter,
        estConnecte,
        aAcces,
        obtenirUtilisateurConnecte,
        listerUtilisateurs,
        creerUtilisateur,
        afficherGestionUtilisateurs,
        restaurerSession
    };
})();
