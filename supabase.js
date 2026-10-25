"use strict";

/* ==========================================
   SAINT-AMOUR BAR PRO
   Initialisation et authentification Supabase
   ========================================== */

(function () {
    const SUPABASE_URL =
        "https://cruphgiafccettqcqozn.supabase.co";

    // Conserve ici ta clé publique actuelle.
    // Ne jamais utiliser la clé service_role.
    const SUPABASE_PUBLIC_KEY = "sb_publishable_kMnHVLNBgIKke4uZhLZ76A_dO9thr_9";

    let client = null;

    /* ==========================================
       AFFICHAGE DES MESSAGES
       ========================================== */

    function afficherResultat(message, erreur) {
        const zone = document.getElementById(
            "resultatTestSupabase"
        );

        if (zone) {
            zone.textContent = message;
            zone.style.color = erreur
                ? "#ff6b6b"
                : "#38d996";
        }

        if (erreur) {
            console.error(message, erreur);
        } else {
            console.log(message);
        }
    }

    /* ==========================================
       INITIALISATION SUPABASE
       ========================================== */

    function initialiserSupabase() {
        if (client) return true;

        if (
            !window.supabase ||
            typeof window.supabase.createClient !== "function"
        ) {
            afficherResultat(
                "Erreur : la bibliothèque Supabase n'est pas chargée.",
                true
            );
            return false;
        }

        if (
            !SUPABASE_PUBLIC_KEY ||
            SUPABASE_PUBLIC_KEY === "COLLE_ICI_TA_CLE_PUBLIQUE" ||
            SUPABASE_PUBLIC_KEY === "masque"
        ) {
            afficherResultat(
                "Ajoute ta véritable clé publique dans js/supabase.js.",
                true
            );
            return false;
        }

        try {
            client = window.supabase.createClient(
                SUPABASE_URL,
                SUPABASE_PUBLIC_KEY
            );

            window.clientSupabase = client;

            afficherResultat(
                "Client Supabase initialisé.",
                false
            );

            return true;
        } catch (erreur) {
            afficherResultat(
                "Erreur d'initialisation : " +
                (erreur.message || erreur),
                true
            );

            return false;
        }
    }

    /* ==========================================
       TEST DE CONNEXION
       ========================================== */

    async function testerConnexionSupabase() {
        if (!navigator.onLine) {
            afficherResultat(
                "Internet est nécessaire pour tester Supabase.",
                true
            );
            return;
        }

        if (!initialiserSupabase()) return;

        afficherResultat(
            "Test Supabase en cours...",
            false
        );

        try {
            const { error } = await client
                .from("bar_appareils")
                .select("id")
                .limit(1);

            if (error) throw error;

            afficherResultat(
                "Connexion réussie ! Supabase répond correctement.",
                false
            );
        } catch (erreur) {
            afficherResultat(
                "Échec du test : " +
                (erreur.message || "Erreur inconnue."),
                true
            );
        }
    }

    /* ==========================================
       CONNEXION UTILISATEUR
       ========================================== */

    async function connecterSupabase(
        identifiant,
        motDePasse
    ) {
        if (!navigator.onLine) {
            throw new Error(
                "Internet est nécessaire pour ouvrir une nouvelle session."
            );
        }

        if (!initialiserSupabase()) {
            throw new Error(
                "Impossible d'initialiser Supabase. " +
                "Vérifie la bibliothèque et la clé publique."
            );
        }

        identifiant = String(identifiant || "")
            .trim()
            .toLowerCase();

        motDePasse = String(motDePasse || "");

        if (!identifiant || !motDePasse) {
            throw new Error(
                "Saisis ton identifiant et ton mot de passe."
            );
        }

        let emailConnexion = identifiant;

        // Les comptes employés utilisent une adresse interne.
        // Le Directeur conserve son adresse e-mail habituelle.
        if (
            /^[a-z0-9._-]{3,40}$/.test(identifiant) &&
            !identifiant.includes("@")
        ) {
            emailConnexion =
                identifiant + "@barpro.invalid";
        }

        const { data, error } =
            await client.auth.signInWithPassword({
                email: emailConnexion,
                password: motDePasse
            });

        if (error) {
            throw new Error(
                "Connexion refusée. Vérifie l'identifiant et le mot de passe."
            );
        }

        if (!data.user) {
            throw new Error(
                "Supabase n'a retourné aucun utilisateur."
            );
        }

        const { data: profil, error: erreurProfil } =
            await client
                .from("bar_profils")
                .select(
                    "id, nom, role, actif, caisse_id, emplacement_stock_id"
                )
                .eq("id", data.user.id)
                .maybeSingle();

        if (erreurProfil) {
            await client.auth.signOut();

            throw new Error(
                "Impossible de lire le profil : " +
                erreurProfil.message
            );
        }

        if (
            !profil ||
            profil.actif !== true ||
            !["directeur", "caissier", "stock"].includes(
                profil.role
            )
        ) {
            await client.auth.signOut();

            throw new Error(
                "Profil absent, désactivé ou rôle non autorisé."
            );
        }

        const utilisateurConnecte = {
            uid: data.user.id,
            email: data.user.email,
            identifiant:
                data.user.user_metadata?.identifiant ||
                identifiant,
            nom: profil.nom,
            role: profil.role,
            caisse_id: profil.caisse_id,
            emplacement_stock_id:
                profil.emplacement_stock_id
        };

        window.utilisateurBarConnecte =
            utilisateurConnecte;

        return utilisateurConnecte;
    }

    /* ==========================================
       RESTAURATION DE SESSION
       ========================================== */

    async function restaurerSessionSupabase() {
        if (!initialiserSupabase()) return null;

        const { data, error } =
            await client.auth.getSession();

        if (error) {
            throw new Error(
                "Impossible de restaurer la session : " +
                error.message
            );
        }

        if (!data.session || !data.session.user) {
            window.utilisateurBarConnecte = null;
            return null;
        }

        const utilisateur = data.session.user;

        const { data: profil, error: erreurProfil } =
            await client
                .from("bar_profils")
                .select(
                    "id, nom, role, actif, caisse_id, emplacement_stock_id"
                )
                .eq("id", utilisateur.id)
                .maybeSingle();

        if (erreurProfil) {
            throw new Error(
                "Impossible de récupérer le profil : " +
                erreurProfil.message
            );
        }

        if (
            !profil ||
            profil.actif !== true ||
            !["directeur", "caissier", "stock"].includes(
                profil.role
            )
        ) {
            await client.auth.signOut();
            window.utilisateurBarConnecte = null;
            return null;
        }

        const utilisateurConnecte = {
            uid: utilisateur.id,
            email: utilisateur.email,
            identifiant:
                utilisateur.user_metadata?.identifiant || "",
            nom: profil.nom,
            role: profil.role,
            caisse_id: profil.caisse_id,
            emplacement_stock_id:
                profil.emplacement_stock_id
        };

        window.utilisateurBarConnecte =
            utilisateurConnecte;

        return utilisateurConnecte;
    }

    /* ==========================================
       CRÉATION D'UN COMPTE EMPLOYÉ
       ========================================== */

    async function creerUtilisateurSupabase(
        nom,
        identifiant,
        motDePasse,
        role
    ) {
        if (!navigator.onLine) {
            throw new Error(
                "Internet est nécessaire pour créer un compte employé."
            );
        }

        if (!initialiserSupabase()) {
            throw new Error(
                "Supabase n'est pas initialisé."
            );
        }

        const {
            data: sessionData,
            error: sessionError
        } = await client.auth.getSession();

        if (
            sessionError ||
            !sessionData.session ||
            !sessionData.session.access_token
        ) {
            throw new Error(
                "Connecte-toi avec le compte Directeur " +
                "avant de créer un employé."
            );
        }

        const { data, error } =
            await client.functions.invoke(
                "creer-utilisateur-bar",
                {
                    body: {
                        nom: String(nom || "").trim(),
                        identifiant: String(
                            identifiant || ""
                        ).trim().toLowerCase(),
                        motDePasse: String(
                            motDePasse || ""
                        ),
                        role: String(role || "")
                    },
                    headers: {
                        Authorization:
                            "Bearer " +
                            sessionData.session.access_token
                    }
                }
            );

        if (error) {
            console.error(
                "Erreur de création du compte :",
                error
            );

            throw new Error(
                "Création impossible. Vérifie le déploiement " +
                "de la fonction et les journaux Supabase."
            );
        }

        if (!data || data.succes !== true) {
            throw new Error(
                data && data.erreur
                    ? data.erreur
                    : "La création du compte a échoué."
            );
        }

        return data;
    }

    /* ==========================================
       DÉCONNEXION
       ========================================== */

    async function deconnecterSupabase() {
        if (!initialiserSupabase()) return;

        const { error } = await client.auth.signOut();

        if (error) {
            throw new Error(
                "Erreur de déconnexion : " +
                error.message
            );
        }

        window.utilisateurBarConnecte = null;
    }

    /* ==========================================
       BOUTON DE TEST
       ========================================== */

    function installerBoutonTest() {
        const bouton = document.getElementById(
            "boutonTesterSupabase"
        );

        if (
            !bouton ||
            bouton.dataset.testInstalle === "oui"
        ) {
            return;
        }

        bouton.dataset.testInstalle = "oui";

        bouton.addEventListener("click", function (event) {
            event.preventDefault();

            testerConnexionSupabase();
        });
    }

    /* ==========================================
       FONCTIONS ACCESSIBLES AUX AUTRES FICHIERS
       ========================================== */

    window.initialiserSupabase =
        initialiserSupabase;

    window.obtenirClientSupabase = function () {
        return client;
    };

    window.testerConnexionSupabase =
        testerConnexionSupabase;

    window.connecterSupabase =
        connecterSupabase;

    window.restaurerSessionSupabase =
        restaurerSessionSupabase;

    window.creerUtilisateurSupabase =
        creerUtilisateurSupabase;

    window.deconnecterSupabase =
        deconnecterSupabase;

    /* Compatibilité avec les appels utilisant
       U.connecterAvecSupabase. */
    window.U = window.U || {};

    window.U.connecterAvecSupabase =
        connecterSupabase;

    window.U.restaurerSessionSupabase =
        restaurerSessionSupabase;

    /* ==========================================
       DÉMARRAGE
       ========================================== */

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            installerBoutonTest,
            { once: true }
        );
    } else {
        installerBoutonTest();
    }
})();
