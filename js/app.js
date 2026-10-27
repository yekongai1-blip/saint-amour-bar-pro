"use strict";

/* ==========================================
   SAINT-AMOUR BAR PRO
   Navigation, connexion et tableau de bord
   ========================================== */

(function () {
    const U = window.BarUtilisateurs;
    const $ = id => document.getElementById(id);

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
        return (
            (Number(montant) || 0).toLocaleString("fr-FR") +
            " FCFA"
        );
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

        if (element) {
            element.textContent = valeur;
        }
    }

    function afficherMessage(id, texte) {
        const element = $(id);

        if (element) {
            element.textContent = texte;
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

        if (connexion) {
            connexion.classList.add("cache");
        }

        if (entete) {
            entete.classList.remove("cache");
        }

        if (menu) {
            menu.classList.remove("cache");
        }

        if (principal) {
            principal.classList.remove("cache");
        }

        if (pied) {
            pied.classList.remove("cache");
        }

        afficherInformationsUtilisateur();
        appliquerAutorisationsMenu();
        afficherPage("accueil");
    }

    async function afficherEcranConnexion() {
        const connexion = $("ecranConnexion");
        const entete = document.querySelector(".entete");
        const menu = document.querySelector(".menu");
        const principal = document.querySelector("main");
        const pied = document.querySelector("footer");
        const infos = $("informationsUtilisateur");

        if (connexion) {
            connexion.classList.remove("cache");
        }

        if (entete) {
            entete.classList.add("cache");
        }

        if (menu) {
            menu.classList.add("cache");
        }

        if (principal) {
            principal.classList.add("cache");
        }

        if (pied) {
            pied.classList.add("cache");
        }

        if (infos) {
            infos.classList.add("cache");
        }

        const config = $("configurationDirecteur");
        const formulaire =
            $("formConnexion") || $("formulaireConnexion");
        const message = $("messageConnexion");

        if (!U) {
            if (message) {
                message.textContent =
                    "Erreur : utilisateurs.js n'est pas chargé.";
            }

            console.error(
                "SAINT-AMOUR BAR PRO : BarUtilisateurs indisponible."
            );

            return;
        }

        try {
            const utilisateurs =
                typeof U.listerUtilisateurs === "function"
                    ? await U.listerUtilisateurs()
                    : [];

            if (
                typeof U.estConnecte === "function" &&
                U.estConnecte()
            ) {
                afficherApplication();
                return;
            }

            const directeurLocalExiste =
                Array.isArray(utilisateurs) &&
                utilisateurs.some(utilisateur =>
                    utilisateur.role === "directeur" &&
                    utilisateur.actif !== false
                );

            /*
             * Si la fonction Supabase existe, on affiche le formulaire
             * de connexion même si aucun compte n'est enregistré
             * dans la base locale IndexedDB.
             */
            const supabaseDisponible =
                typeof U.connecterAvecSupabase === "function";

            const directeurExiste =
                directeurLocalExiste || supabaseDisponible;

            if (config) {
                config.classList.toggle(
                    "cache",
                    directeurExiste
                );
            }

            if (formulaire) {
                formulaire.classList.toggle(
                    "cache",
                    !directeurExiste
                );
            }

            if (message) {
                message.textContent = directeurExiste
                    ? "Connectez-vous avec votre identifiant et votre mot de passe."
                    : "Créez votre premier compte Directeur.";
            }
        } catch (erreur) {
            console.error(
                "Erreur d'affichage de la connexion :",
                erreur
            );

            /*
             * En cas d'erreur de lecture, on laisse le formulaire
             * de connexion visible pour permettre un nouvel essai.
             */
            if (config) {
                config.classList.add("cache");
            }

            if (formulaire) {
                formulaire.classList.remove("cache");
            }

            if (message) {
                message.textContent =
                    "Impossible de lire les utilisateurs. " +
                    "Vérifiez la base de données.";
            }
        }
    }

    window.afficherEcranConnexion = afficherEcranConnexion;

    function afficherInformationsUtilisateur() {
        const infos = $("informationsUtilisateur");
        const nom = $("nomUtilisateurConnecte");
        const role = $("roleUtilisateurConnecte");

        if (
            !U ||
            typeof U.obtenirUtilisateurConnecte !== "function"
        ) {
            return;
        }

        const utilisateur = U.obtenirUtilisateurConnecte();

        if (infos) {
            infos.classList.remove("cache");
        }

        if (nom) {
            nom.textContent = utilisateur
                ? utilisateur.nom ||
                  utilisateur.identifiant ||
                  ""
                : "";
        }

        if (role) {
            role.textContent = utilisateur
                ? nomsRoles[utilisateur.role] ||
                  utilisateur.role ||
                  ""
                : "";
        }
    }

    function appliquerAutorisationsMenu() {
        if (!U || typeof U.aAcces !== "function") {
            return;
        }

        document.querySelectorAll(
            "button[data-page], " +
            "button[data-page-target], " +
            "button[data-page-btn], " +
            "button[data-section]"
        ).forEach(bouton => {
            const cible =
                bouton.dataset.page ||
                bouton.dataset.pageTarget ||
                bouton.dataset.pageBtn ||
                bouton.dataset.section;

            if (cible && pagesBar.includes(cible)) {
                bouton.hidden = !U.aAcces(cible);
            }
        });
    }

    /* ==========================================
       AUTHENTIFICATION
       ========================================== */

    function initialiserAuthentification() {
        const formDirecteur = $("formPremierDirecteur");

        const formConnexion =
            $("formConnexion") || $("formulaireConnexion");

        const boutonDeconnexion = $("boutonDeconnexion");

        /*
         * Création du premier compte Directeur local.
         */
        if (
            formDirecteur &&
            !formDirecteur.dataset.initialise
        ) {
            formDirecteur.dataset.initialise = "oui";

            formDirecteur.addEventListener(
                "submit",
                async event => {
                    event.preventDefault();

                    const message = $("messageConnexion");

                    const bouton = formDirecteur.querySelector(
                        'button[type="submit"]'
                    );

                    const nom =
                        $("nomDirecteur")?.value.trim();

                    const identifiant =
                        $("identifiantDirecteur")?.value.trim();

                    const motDePasse =
                        $("motDePasseDirecteur")?.value;

                    try {
                        if (bouton) {
                            bouton.disabled = true;
                        }

                        if (typeof ouvrirBase === "function") {
                            await ouvrirBase();
                        }

                        if (
                            !U ||
                            typeof U.initialiserPremierDirecteur !==
                                "function"
                        ) {
                            throw new Error(
                                "La création du compte Directeur n'est pas disponible."
                            );
                        }

                        await U.initialiserPremierDirecteur(
                            nom,
                            identifiant,
                            motDePasse
                        );

                        if (message) {
                            message.textContent =
                                "Compte créé. Connectez-vous maintenant.";
                        }

                        const champIdentifiant =
                            $("identifiantConnexion");

                        const config =
                            $("configurationDirecteur");

                        const formulaire =
                            $("formConnexion") ||
                            $("formulaireConnexion");

                        if (config) {
                            config.classList.add("cache");
                        }

                        if (formulaire) {
                            formulaire.classList.remove("cache");
                        }

                        if (champIdentifiant) {
                            champIdentifiant.value =
                                identifiant || "";

                            champIdentifiant.focus();
                        }

                        formDirecteur.reset();
                    } catch (erreur) {
                        console.error(
                            "Erreur de création du compte :",
                            erreur
                        );

                        if (message) {
                            message.textContent =
                                erreur.message ||
                                "Création du compte impossible.";
                        }
                    } finally {
                        if (bouton) {
                            bouton.disabled = false;
                        }
                    }
                }
            );
        }

        /*
         * Connexion Supabase ou locale.
         */
        if (
            formConnexion &&
            !formConnexion.dataset.initialise
        ) {
            formConnexion.dataset.initialise = "oui";

            formConnexion.addEventListener(
                "submit",
                async event => {
                    event.preventDefault();

                    const message = $("messageConnexion");

                    const bouton = formConnexion.querySelector(
                        'button[type="submit"]'
                    );

                    try {
                        if (bouton) {
                            bouton.disabled = true;
                        }

                        if (typeof ouvrirBase === "function") {
                            await ouvrirBase();
                        }

                        const identifiant =
                            $("identifiantConnexion")?.value.trim();

                        const motDePasse =
                            $("motDePasseConnexion")?.value;

                        if (!U) {
                            throw new Error(
                                "Le module utilisateurs.js n'est pas chargé."
                            );
                        }

                        let utilisateur;

                        if (
                            typeof U.connecterAvecSupabase ===
                            "function"
                        ) {
                            utilisateur =
                                await U.connecterAvecSupabase(
                                    identifiant,
                                    motDePasse
                                );
                        } else if (
                            typeof U.connecter === "function"
                        ) {
                            utilisateur = await U.connecter(
                                identifiant,
                                motDePasse
                            );
                        } else {
                            throw new Error(
                                "Aucune fonction de connexion disponible dans utilisateurs.js."
                            );
                        }

                        if (!utilisateur) {
                            throw new Error(
                                "La connexion n'a retourné aucun utilisateur."
                            );
                        }

                        formConnexion.reset();

                        afficherApplication();
                    } catch (erreur) {
                        console.error(
                            "Erreur de connexion :",
                            erreur
                        );

                        if (message) {
                            message.textContent =
                                erreur.message ||
                                "Identifiant ou mot de passe incorrect.";
                        }
                    } finally {
                        if (bouton) {
                            bouton.disabled = false;
                        }
                    }
                }
            );
        }

        /*
         * Déconnexion.
         */
        if (
            boutonDeconnexion &&
            !boutonDeconnexion.dataset.initialise
        ) {
            boutonDeconnexion.dataset.initialise = "oui";

            boutonDeconnexion.addEventListener(
                "click",
                async () => {
                    if (
                        !confirm(
                            "Voulez-vous vraiment vous déconnecter ?"
                        )
                    ) {
                        return;
                    }

                    try {
                        if (
                            U &&
                            typeof U.deconnecter === "function"
                        ) {
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
        if (
            !U ||
            typeof U.estConnecte !== "function" ||
            !U.estConnecte()
        ) {
            afficherEcranConnexion();
            return;
        }

        if (
            !pagesBar.includes(nomPage) ||
            (
                typeof U.aAcces === "function" &&
                !U.aAcces(nomPage)
            )
        ) {
            nomPage = "accueil";
        }

        const page = $("page-" + nomPage);

        if (!page) {
            console.error(
                "Section introuvable : page-" + nomPage
            );
            return;
        }

        document.querySelectorAll("main .page").forEach(
            section => {
                section.classList.add("cache");
            }
        );

        page.classList.remove("cache");

        document.querySelectorAll(
            "button[data-page], " +
            "button[data-page-target], " +
            "button[data-page-btn], " +
            "button[data-section]"
        ).forEach(bouton => {
            const cible =
                bouton.dataset.page ||
                bouton.dataset.pageTarget ||
                bouton.dataset.pageBtn ||
                bouton.dataset.section;

            bouton.classList.toggle(
                "actif",
                cible === nomPage
            );
        });

        actualiserPage(nomPage);
    }

    function initialiserNavigation() {
        if (navigationInitialisee) {
            return;
        }

        navigationInitialisee = true;

        document.addEventListener("click", event => {
            const element = event.target;

            if (!(element instanceof Element)) {
                return;
            }

            const bouton = element.closest(
                "button[data-page], " +
                "button[data-page-target], " +
                "button[data-page-btn], " +
                "button[data-section]"
            );

            if (!bouton) {
                return;
            }

            const cible =
                bouton.dataset.page ||
                bouton.dataset.pageTarget ||
                bouton.dataset.pageBtn ||
                bouton.dataset.section;

            if (!pagesBar.includes(cible)) {
                return;
            }

            event.preventDefault();

            if (!U || !U.estConnecte()) {
                afficherEcranConnexion();
                return;
            }

            if (
                typeof U.aAcces === "function" &&
                !U.aAcces(cible)
            ) {
                alert(
                    "Vous n'avez pas accès à cette rubrique."
                );
                return;
            }

            afficherPage(cible);
        });
    }

    /* ==========================================
       ACTUALISATION DES MODULES
       ========================================== */

    async function actualiserPage(nomPage) {
        if (
            !U ||
            !U.estConnecte() ||
            (
                typeof U.aAcces === "function" &&
                !U.aAcces(nomPage)
            )
        ) {
            return;
        }

        try {
            switch (nomPage) {
                case "accueil":
                    await actualiserStatistiques();
                    break;

                case "ventes":
                    if (
                        typeof window.afficherPanierVente ===
                        "function"
                    ) {
                        await window.afficherPanierVente();
                    }
                    break;
case "produits":
                    if (
                        typeof window.afficherProduitsBar ===
                        "function"
                    ) {
                        await window.afficherProduitsBar();
                    } else if (
                        typeof window.afficherProduits ===
                        "function"
                    ) {
                        await window.afficherProduits();
                    }
                    break;

                case "stock":
                    if (
                        typeof window.afficherStockBar ===
                        "function"
                    ) {
                        await window.afficherStockBar();
                    } else if (
                        typeof window.afficherStock ===
                        "function"
                    ) {
                        await window.afficherStock();
                    }
                    break;

                case "caisse":
                    if (
                        typeof window.afficherHistoriqueCaisse ===
                        "function"
                    ) {
                        await window.afficherHistoriqueCaisse();
                    }
                    break;

                case "depenses":
                    if (
                        typeof window.afficherDepenses ===
                        "function"
                    ) {
                        await window.afficherDepenses();
                    }
                    break;

                case "dettes":
                    if (
                        typeof window.afficherDettes ===
                        "function"
                    ) {
                        await window.afficherDettes();
                    }
                    break;

                case "rapports":
                    if (
                        typeof window.afficherRapports ===
                        "function"
                    ) {
                        await window.afficherRapports();
                    }
                    break;

                case "parametres":
                    if (
                        typeof window.afficherParametres ===
                        "function"
                    ) {
                        await window.afficherParametres();
                    }
                    break;

                case "sauvegarde":
                    if (
                        typeof window.afficherPanneauSauvegardeBar ===
                        "function"
                    ) {
                        window.afficherPanneauSauvegardeBar(
                            $("page-sauvegarde")
                        );
                    }
                    break;

                case "synchronisation":
                    if (
                        window.BarSynchronisation &&
                        typeof window.BarSynchronisation
                            .afficherEtatSynchronisation ===
                            "function"
                    ) {
                        await window.BarSynchronisation
                            .afficherEtatSynchronisation(
                                "contenuPrincipal"
                            );
                    } else {
                        const contenu =
                            $("contenuPrincipal");

                        if (contenu) {
                            contenu.textContent =
                                "Le module de synchronisation n'est pas chargé.";
                        }
                    }
                    break;

                case "utilisateurs":
                    if (
                        typeof U.afficherGestionUtilisateurs ===
                        "function"
                    ) {
                        await U.afficherGestionUtilisateurs(
                            $("contenuUtilisateurs")
                        );
                    }
                    break;
            }
        } catch (erreur) {
            console.error(
                "Erreur sur la page " + nomPage + " :",
                erreur
            );

            const message = $("messageParametres");

            if (message) {
                message.textContent =
                    "Erreur : " +
                    (erreur.message || String(erreur));
            }
        }
    }

    /* ==========================================
       TABLEAU DE BORD
       ========================================== */

    async function actualiserStatistiques() {
        if (
            !U ||
            !U.estConnecte() ||
            (
                typeof U.aAcces === "function" &&
                !U.aAcces("accueil")
            )
        ) {
            return;
        }

        try {
            const [ventes, depenses, produits] =
                await Promise.all([
                    lireTous("ventes"),
                    lireTous("depenses"),
                    lireTous("produits")
                ]);

            const aujourdHui = dateLocale(new Date());

            const ventesDuJour = (ventes || []).filter(
                vente => {
                    const statut = String(
                        vente.statut || ""
                    ).toLowerCase();

                    if ([
                        "annulée",
                        "annulee",
                        "annulé",
                        "annule",
                        "supprimée",
                        "supprimee"
                    ].includes(statut)) {
                        return false;
                    }

                    return dateLocale(
                        vente.date || vente.dateCreation
                    ) === aujourdHui;
                }
            );

            const depensesDuJour = (depenses || []).filter(
                depense =>
                    dateLocale(
                        depense.date || depense.dateCreation
                    ) === aujourdHui
            );

            const chiffreAffaires =
                ventesDuJour.reduce(
                    (total, vente) =>
                        total + (Number(vente.total) || 0),
                    0
                );

            const totalDepenses =
                depensesDuJour.reduce(
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

            const ruptures = listeProduits.filter(
                produit =>
                    (Number(produit.quantiteStock) || 0) <= 0
            );

            const stocksFaibles = listeProduits.filter(
                produit => {
                    const quantite =
                        Number(produit.quantiteStock) || 0;

                    const seuil =
                        Number(produit.seuilAlerte) || 5;

                    return quantite > 0 && quantite <= seuil;
                }
            );

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

            if (
                typeof window.afficherGraphiqueVentes ===
                "function"
            ) {
                window.afficherGraphiqueVentes(
                    ventesDuJour
                );
            }
        } catch (erreur) {
            console.error(
                "Erreur du tableau de bord :",
                erreur
            );
        }
    }

    /* ==========================================
       DÉMARRAGE
       ========================================== */

    async function initialiserApplication() {
        if (demarrageEnCours) {
            return;
        }

        demarrageEnCours = true;

        try {
            if (typeof ouvrirBase === "function") {
                await ouvrirBase();
            }

            initialiserNavigation();
            initialiserAuthentification();

            let sessionActive = false;

            if (
                U &&
                typeof U.restaurerSession === "function"
            ) {
                sessionActive = await U.restaurerSession();
            } else if (
                U &&
                typeof U.estConnecte === "function"
            ) {
                sessionActive = U.estConnecte();
            }

            if (sessionActive) {
                afficherApplication();
            } else {
                await afficherEcranConnexion();
            }
        } catch (erreur) {
            console.error(
                "Erreur au démarrage de SAINT-AMOUR BAR PRO :",
                erreur
            );

            afficherMessage(
                "messageConnexion",
                "Erreur au démarrage : " +
                (erreur.message || String(erreur))
            );
        } finally {
            demarrageEnCours = false;
        }

        console.log(
            "SAINT-AMOUR BAR PRO : initialisation terminée."
        );
    }

    /* Démarrage lorsque le document est prêt */
    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialiserApplication,
            { once: true }
        );
    } else {
        initialiserApplication();
    }
})();
