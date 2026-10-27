"use strict";

/* ==========================================
   SAINT-AMOUR BAR PRO
   Navigation, authentification et tableau de bord
   ========================================== */

(function () {
    const $ = id => document.getElementById(id);
    const U = window.BarUtilisateurs;

    const pagesBar = [
        "accueil",
        "ventes",
        "produits",
        "stock",
        "caisse",
        "depenses",
        "dettes",
        "rapports",
        "parametres",
        "sauvegarde",
        "utilisateurs",
        "synchronisation"
    ];

    const nomsRoles = {
        directeur: "Directeur",
        caissier: "Caissier",
        stock: "Gestionnaire de stock"
    };

    let navigationInitialisee = false;
    let demarrageEnCours = false;

    /* ==========================================
       OUTILS
       ========================================== */

    function formaterFCFA(montant) {
        return (Number(montant) || 0).toLocaleString("fr-FR")
            + " FCFA";
    }

    function dateLocale(valeur) {
        if (!valeur) return "";

        const date = new Date(valeur);

        if (Number.isNaN(date.getTime())) return "";

        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    }

    function mettreAJour(id, valeur) {
        const element = $(id);
        if (element) element.textContent = valeur;
    }

    function afficherErreur(message) {
        console.error(message);

        const zone = $("messageConnexion");

        if (zone) {
            zone.textContent = message instanceof Error
                ? message.message
                : String(message);
        }
    }

    /* ==========================================
       AFFICHAGE DE L'APPLICATION
       ========================================== */

    function afficherApplication() {
        const connexion = $("ecranConnexion");
        const entete = document.querySelector(".entete");
        const menu = document.querySelector(".menu");
        const principal = document.querySelector("main");
        const pied = document.querySelector("footer");

        if (connexion) connexion.classList.add("cache");
        if (entete) entete.classList.remove("cache");
        if (menu) menu.classList.remove("cache");
        if (principal) principal.classList.remove("cache");
        if (pied) pied.classList.remove("cache");

        afficherInformationsUtilisateur();
        afficherPage("accueil");
    }

    async function afficherEcranConnexion() {
        const connexion = $("ecranConnexion");
        const entete = document.querySelector(".entete");
        const menu = document.querySelector(".menu");
        const principal = document.querySelector("main");
        const pied = document.querySelector("footer");

        if (connexion) connexion.classList.remove("cache");
        if (entete) entete.classList.add("cache");
        if (menu) menu.classList.add("cache");
        if (principal) principal.classList.add("cache");
        if (pied) pied.classList.add("cache");

        const infos = $("informationsUtilisateur");
        if (infos) infos.classList.add("cache");

        const config = $("configurationDirecteur");
        const formulaire = $("formConnexion");
        const message = $("messageConnexion");

        if (!U) {
            if (message) {
                message.textContent =
                    "Erreur : le module utilisateurs.js est indisponible.";
            }
            return;
        }

        try {
            const utilisateurs = await U.listerUtilisateurs();

            if (U.estConnecte()) {
                afficherApplication();
                return;
            }

            const directeurExiste = utilisateurs.some(utilisateur =>
                utilisateur.role === "directeur" &&
                utilisateur.actif !== false
            );

            if (config) {
                config.classList.toggle("cache", directeurExiste);
            }

            if (formulaire) {
                formulaire.classList.toggle("cache", !directeurExiste);
            }

            if (message) {
                message.textContent = directeurExiste
                    ? "Connectez-vous avec vos identifiants."
                    : "Créez votre premier compte Directeur.";
            }
        } catch (erreur) {
            console.error(erreur);

            if (message) {
                message.textContent =
                    "Impossible de lire les utilisateurs. Vérifiez la base locale.";
            }
        }
    }

    window.afficherEcranConnexion = afficherEcranConnexion;

    function afficherInformationsUtilisateur() {
        if (!U ||
            typeof U.obtenirUtilisateurConnecte !== "function") {
            return;
        }

        const infos = $("informationsUtilisateur");
        const nom = $("nomUtilisateurConnecte");
        const role = $("roleUtilisateurConnecte");

        const utilisateur = U.obtenirUtilisateurConnecte();

        if (infos) {
            infos.classList.toggle("cache", !utilisateur);
        }

        if (nom) {
            nom.textContent = utilisateur
                ? utilisateur.nom || utilisateur.identifiant || ""
                : "";
        }

        if (role) {
            role.textContent = utilisateur
                ? nomsRoles[utilisateur.role] || utilisateur.role || ""
                : "";
        }
    }

    /* ==========================================
       CRÉATION DU DIRECTEUR ET CONNEXION
       ========================================== */

    function initialiserAuthentification() {
        const formDirecteur = $("formPremierDirecteur");
        const formConnexion = $("formConnexion");
        const boutonDeconnexion = $("boutonDeconnexion");

        if (formDirecteur &&
            !formDirecteur.dataset.initialise) {

            formDirecteur.dataset.initialise = "oui";

            formDirecteur.addEventListener(
                "submit",
                async event => {
                    event.preventDefault();

                    const bouton = formDirecteur.querySelector(
                        'button[type="submit"]'
                    );

                    try {
                        if (!U) {
                            throw new Error(
                                "Le module utilisateurs.js est indisponible."
                            );
                        }

                        if (bouton) bouton.disabled = true;

                        await ouvrirBase();

                        const nom = $("nomDirecteur").value.trim();
                        const identifiant =
                            $("identifiantDirecteur").value.trim();
                        const motDePasse =
                            $("motDePasseDirecteur").value;

                        await U.initialiserPremierDirecteur(
                            nom,
                            identifiant,
                            motDePasse
                        );

                        formDirecteur.reset();

                        if ($("identifiantConnexion")) {
                            $("identifiantConnexion").value = identifiant;
                        }

                        if ($("configurationDirecteur")) {
                            $("configurationDirecteur")
                                .classList.add("cache");
                        }

                        if (formConnexion) {
                            formConnexion.classList.remove("cache");
                        }

                        mettreAJour(
                            "messageConnexion",
                            "Compte Directeur créé. Connectez-vous maintenant."
                        );
                    } catch (erreur) {
                        afficherErreur(erreur);
                    } finally {
                        if (bouton) bouton.disabled = false;
                    }
                }
            );
        }

        if (formConnexion &&
            !formConnexion.dataset.initialise) {

            formConnexion.dataset.initialise = "oui";

            formConnexion.addEventListener(
                "submit",
                async event => {
                    event.preventDefault();

                    const bouton = formConnexion.querySelector(
                        'button[type="submit"]'
                    );

                    try {
                        if (!U) {
                            throw new Error(
                                "Le module utilisateurs.js est indisponible."
                            );
                        }

                        if (bouton) bouton.disabled = true;

                        await ouvrirBase();

                        const identifiant =
                            $("identifiantConnexion").value.trim();
                        const motDePasse =
                            $("motDePasseConnexion").value;

                        /*
                         * Utilise la fonction disponible dans ton module.
                         * La version locale expose connecter().
                         */
                        let utilisateur;

                        if (typeof U.connecterAvecSupabase !== "function") {
    throw new Error(
        "Le module Supabase Auth n'est pas chargé."
    );
}

const utilisateur = await U.connecterAvecSupabase(
    identifiant,
    motDePasse
); else if (
                            typeof U.connecterAvecSupabase === "function"
                        ) {
                            utilisateur = await U.connecterAvecSupabase(
                                identifiant,
                                motDePasse
                            );
                        } else {
                            throw new Error(
                                "Aucune fonction de connexion compatible dans utilisateurs.js."
                            );
                        }

                        formConnexion.reset();

                        afficherApplication(utilisateur);
                    } catch (erreur) {
                        afficherErreur(
                            erreur.message ||
                            "Identifiant ou mot de passe incorrect."
                        );
                    } finally {
                        if (bouton) bouton.disabled = false;
                    }
                }
            );
        }

        if (boutonDeconnexion &&
            !boutonDeconnexion.dataset.initialise) {

            boutonDeconnexion.dataset.initialise = "oui";

            boutonDeconnexion.addEventListener(
                "click",
                async () => {
                    if (!confirm("Voulez-vous vraiment vous déconnecter ?")) {
                        return;
                    }

                    try {
                        if (U &&
                            typeof U.deconnecter === "function") {
                            await U.deconnecter();
                        }
                    } catch (erreur) {
                        console.error(
                            "Erreur de déconnexion :",
                            erreur
                        );
                    }

                    await afficherEcranConnexion();
                }
            );
        }
    }

    /* ==========================================
       NAVIGATION
       ========================================== */

    function afficherPage(nomPage) {
        if (!U || !U.estConnecte()) {
            afficherEcranConnexion();
            return;
        }

        if (!pagesBar.includes(nomPage) ||
            !U.aAcces(nomPage)) {
            nomPage = "accueil";
        }

        const page = $("page-" + nomPage);

        if (!page) {
            console.error(
                "Section introuvable : page-" + nomPage
            );
            return;
        }

        document.querySelectorAll("main .page").forEach(section => {
            section.classList.add("cache");
        });

        page.classList.remove("cache");

        document.querySelectorAll(
            "button[data-page], button[data-page-target], " +
            "button[data-page-btn], button[data-section]"
        ).forEach(bouton => {
            const cible =
                bouton.dataset.page ||
                bouton.dataset.pageTarget ||
                bouton.dataset.pageBtn ||
                bouton.dataset.section;

            bouton.classList.toggle("actif", cible === nomPage);
        });

        actualiserPage(nomPage);
    }

    function initialiserNavigation() {
        if (navigationInitialisee) return;

        navigationInitialisee = true;

        document.addEventListener("click", event => {
            if (!(event.target instanceof Element)) return;

            const bouton = event.target.closest(
                "button[data-page], button[data-page-target], " +
                "button[data-page-btn], button[data-section]"
            );

            if (!bouton) return;

            const cible =
                bouton.dataset.page ||
                bouton.dataset.pageTarget ||
                bouton.dataset.pageBtn ||
                bouton.dataset.section;

            if (!pagesBar.includes(cible)) return;

            event.preventDefault();

            if (!U || !U.estConnecte()) {
                afficherEcranConnexion();
                return;
            }

            if (!U.aAcces(cible)) {
                alert("Vous n'avez pas accès à cette rubrique.");
                return;
            }

            afficherPage(cible);
        });
    }

    /* ==========================================
       ACTUALISATION DES MODULES
       ========================================== */

    async function actualiserPage(nomPage) {
        if (!U ||
            !U.estConnecte() ||
            !U.aAcces(nomPage)) {
            return;
        }

        try {
            switch (nomPage) {
                case "accueil":
                    await actualiserStatistiques();
                    break;

                case "ventes":
                    if (typeof window.afficherPanierVente === "function") {
                        await window.afficherPanierVente();
                    }
                    break;

                case "produits":
                    if (typeof window.afficherProduitsBar === "function") {
                        await window.afficherProduitsBar();
                    } else if (typeof window.afficherProduits === "function") {
                        await window.afficherProduits();
                    }
                    break;

                case "stock":
                    if (typeof window.afficherStockBar === "function") {
                        await window.afficherStockBar();
                    } else if (typeof window.afficherStock === "function") {
                        await window.afficherStock();
                    }
                    break;

                case "caisse":
                    if (typeof window.afficherHistoriqueCaisse === "function") {
                        await window.afficherHistoriqueCaisse();
                    }
                    break;

                case "depenses":
                    if (typeof window.afficherDepenses === "function") {
                        await window.afficherDepenses();
                    }
                    break;

                case "dettes":
                    if (typeof window.afficherDettes === "function") {
                        await window.afficherDettes();
                    }
                    break;

                case "rapports":
                    if (typeof window.afficherRapports === "function") {
                        await window.afficherRapports();
                    }
                    break;

                case "parametres":
                    if (typeof window.afficherParametres === "function") {
                        await window.afficherParametres();
                    }
                    break;

                case "sauvegarde":
                    if (typeof window.afficherPanneauSauvegardeBar === "function") {
                        await window.afficherPanneauSauvegardeBar(
                            $("panneauSauvegarde")
                        );
                    }
                    break;

                case "utilisateurs":
                    if (U &&
                        typeof U.afficherGestionUtilisateurs === "function") {
                        await U.afficherGestionUtilisateurs(
                            $("contenuUtilisateurs")
                        );
                    }
                    break;

                case "synchronisation":
                    if (
                        window.BarSynchronisation &&
                        typeof window.BarSynchronisation
                            .afficherEtatSynchronisation === "function"
                    ) {
                        await window.BarSynchronisation
                            .afficherEtatSynchronisation("contenuPrincipal");
                    } else if ($("contenuPrincipal")) {
                        $("contenuPrincipal").textContent =
                            "Le module de synchronisation n'est pas disponible.";
                    }
                    break;
            }
        } catch (erreur) {
            console.error(
                "Erreur sur la page " + nomPage + " :",
                erreur
            );

            afficherErreur(erreur);
        }
    }

    /* ==========================================
       TABLEAU DE BORD
       ========================================== */

    function actualiserDateAccueil() {
        const element = $("dateAccueil");
        if (!element) return;

        element.textContent = new Date().toLocaleDateString(
            "fr-FR",
            {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric"
            }
        );
    }

    async function actualiserStatistiques() {
        actualiserDateAccueil();

        if (!U ||
            !U.estConnecte() ||
            !U.aAcces("accueil")) {
            return;
        }

        try {
            const [ventes, depenses, produits] = await Promise.all([
                lireTous("ventes"),
                lireTous("depenses"),
                lireTous("produits")
            ]);

            const aujourdHui = dateLocale(new Date());

            const ventesDuJour = (ventes || []).filter(vente => {
                const statut = String(
                    vente.statut || ""
                ).toLowerCase();

                if ([
                    "annulée", "annulee", "annulé", "annule",
                    "supprimée", "supprimee"
                ].includes(statut)) {
                    return false;
                }

                return dateLocale(
                    vente.date || vente.dateCreation
                ) === aujourdHui;
            });

            const depensesDuJour = (depenses || []).filter(depense =>
                dateLocale(
                    depense.date || depense.dateCreation
                ) === aujourdHui
            );

            const chiffreAffaires = ventesDuJour.reduce(
                (total, vente) =>
                    total + (Number(vente.total) || 0),
                0
            );

            const totalDepenses = depensesDuJour.reduce(
                (total, depense) =>
                    total + (Number(depense.montant) || 0),
                0
            );

            const produitsParId = new Map(
                (produits || []).map(produit => [
                    String(produit.id),
                    produit
                ])
            );

            let beneficeBrut = 0;

            ventesDuJour.forEach(vente => {
                const lignes = Array.isArray(vente.lignes)
                    ? vente.lignes
                    : [];

                lignes.forEach(ligne => {
                    const produit = produitsParId.get(
                        String(ligne.idProduit)
                    );

                    const prixVente =
                        Number(ligne.prixUnitaire) || 0;

                    const prixAchat = produit
                        ? Number(produit.prixAchat) || 0
                        : 0;

                    const quantite =
                        Number(ligne.quantite) || 0;

                    beneficeBrut +=
                        (prixVente - prixAchat) * quantite;
                });
            });

            const listeProduits = produits || [];

            const ruptures = listeProduits.filter(produit =>
                (Number(produit.quantiteStock) || 0) <= 0
            );

            const stocksFaibles = listeProduits.filter(produit => {
                const quantite =
                    Number(produit.quantiteStock) || 0;

                const seuil =
                    Number(produit.seuilAlerte) || 5;

                return quantite > 0 && quantite <= seuil;
            });

            mettreAJour(
                "statVentes",
                formaterFCFA(chiffreAffaires)
            );

            mettreAJour(
                "statDepenses",
                formaterFCFA(totalDepenses)
            );

            mettreAJour(
                "statBenefice",
                formaterFCFA(beneficeBrut)
            );

            mettreAJour(
                "statProduits",
                listeProduits.length
            );

            mettreAJour(
                "statRuptures",
                ruptures.length
            );

            mettreAJour(
                "statStockFaible",
                stocksFaibles.length
            );

            afficherGraphiqueVentes(ventesDuJour);

        } catch (erreur) {
            console.error(
                "Erreur du tableau de bord :",
                erreur
            );
        }
    }

    /* Graphique simplifié : répartition des ventes du jour. */
    function afficherGraphiqueVentes(ventes) {
        const zone = $("graphiqueVentes");
        if (!zone) return;

        const liste = Array.isArray(ventes) ? ventes : [];

        if (liste.length === 0) {
            zone.textContent = "Aucune vente enregistrée aujourd'hui.";
            return;
        }

        const total = liste.reduce(
            (somme, vente) => somme + (Number(vente.total) || 0),
            0
        );

        zone.textContent =
            liste.length + " vente(s) aujourd'hui — " +
            formaterFCFA(total);
    }

    /* ==========================================
       DÉMARRAGE
       ========================================== */

    async function initialiserApplication() {
        if (demarrageEnCours) return;

        demarrageEnCours = true;

        try {
            if (typeof ouvrirBase !== "function") {
                throw new Error(
                    "La fonction ouvrirBase() est introuvable dans database.js."
                );
            }

            await ouvrirBase();

            if (!U) {
                throw new Error(
                    "Le module utilisateurs.js n'est pas chargé."
                );
            }

            initialiserAuthentification();
            initialiserNavigation();

            const boutonActualiser = $("actualiserTableauBord");

            if (boutonActualiser &&
                !boutonActualiser.dataset.initialise) {

                boutonActualiser.dataset.initialise = "oui";

                boutonActualiser.addEventListener(
                    "click",
                    actualiserStatistiques
                );
            }

            const sessionValide =
                typeof U.restaurerSession === "function"
                    ? await U.restaurerSession()
                    : false;

            if (sessionValide) {
                afficherApplication();
            } else {
                await afficherEcranConnexion();
            }

        } catch (erreur) {
            console.error(
                "Erreur d'initialisation :",
                erreur
            );

            await afficherEcranConnexion();

        } finally {
            demarrageEnCours = false;
        }

        console.log(
            "SAINT-AMOUR BAR PRO : initialisation terminée."
        );
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialiserApplication,
            { once: true }
        );
    } else {
        initialiserApplication();
    }

    /* Fonctions accessibles aux autres modules. */
    window.actualiserStatistiquesBar = actualiserStatistiques;
    window.afficherPageBar = afficherPage;

})();
