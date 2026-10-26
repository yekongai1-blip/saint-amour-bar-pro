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

    function formaterFCFA(montant) {
        return (Number(montant) || 0).toLocaleString("fr-FR") + " FCFA";
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

    /* ==========================================
       AFFICHAGE DES ÉCRANS
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
        const infos = $("informationsUtilisateur");

        if (connexion) connexion.classList.remove("cache");
        if (entete) entete.classList.add("cache");
        if (menu) menu.classList.add("cache");
        if (principal) principal.classList.add("cache");
        if (pied) pied.classList.add("cache");
        if (infos) infos.classList.add("cache");

        const config = $("configurationDirecteur");
        const formulaire = $("formulaireConnexion");
        const message = $("messageConnexion");

        if (!U) {
            if (message) {
                message.textContent =
                    "Erreur : utilisateurs.js n'est pas chargé.";
            }

            console.error("BarUtilisateurs indisponible.");
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
                    ? "Connectez-vous avec votre identifiant et votre mot de passe."
                    : "Créez votre premier compte Directeur.";
            }
        } catch (erreur) {
            console.error("Erreur de connexion :", erreur);

            if (message) {
                message.textContent =
                    "Impossible de lire les utilisateurs. Vérifiez la base de données.";
            }
        }
    }

    window.afficherEcranConnexion = afficherEcranConnexion;

    function afficherInformationsUtilisateur() {
        const infos = $("informationsUtilisateur");
        const nom = $("nomUtilisateurConnecte");
        const role = $("roleUtilisateurConnecte");

        if (!U || typeof U.obtenirUtilisateurConnecte !== "function") {
            return;
        }

        const utilisateur = U.obtenirUtilisateurConnecte();

        if (infos) infos.classList.remove("cache");

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
       AUTHENTIFICATION
       ========================================== */

    function initialiserAuthentification() {
        const formDirecteur = $("formPremierDirecteur");
        const formConnexion = $("formConnexion");
        const boutonDeconnexion = $("boutonDeconnexion");

        if (formDirecteur && !formDirecteur.dataset.initialise) {
            formDirecteur.dataset.initialise = "oui";

            formDirecteur.addEventListener("submit", async event => {
                event.preventDefault();

                const message = $("messageConnexion");
                const bouton = formDirecteur.querySelector(
                    'button[type="submit"]'
                );

                const nom = $("nomDirecteur")?.value.trim();
                const identifiant = $("identifiantDirecteur")?.value.trim();
                const motDePasse = $("motDePasseDirecteur")?.value;

                try {
                    if (bouton) bouton.disabled = true;

                    await ouvrirBase();
                  if (typeof window.initialiserSupabase === "function") {
    const connexionSupabase = window.initialiserSupabase();

    if (connexionSupabase) {
        console.log("SAINT-AMOUR BAR PRO : Supabase prêt.");
    } else {
        console.log("Mode local disponible ; Supabase non initialisé.");
    }
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

                    const champIdentifiant = $("identifiantConnexion");
                    const config = $("configurationDirecteur");
                    const formulaire = $("formulaireConnexion");

                    if (config) config.classList.add("cache");
                    if (formulaire) formulaire.classList.remove("cache");

                    if (champIdentifiant) {
                        champIdentifiant.value = identifiant || "";
                        champIdentifiant.focus();
                    }

                    formDirecteur.reset();
                } catch (erreur) {
                    console.error(erreur);

                    if (message) {
                        message.textContent =
                            erreur.message || "Création du compte impossible.";
                    }
                } finally {
                    if (bouton) bouton.disabled = false;
                }
            });
        }

        if (formConnexion && !formConnexion.dataset.initialise) {
            formConnexion.dataset.initialise = "oui";

            formConnexion.addEventListener("submit", async event => {
                event.preventDefault();

                const message = $("messageConnexion");
                const bouton = formConnexion.querySelector(
                    'button[type="submit"]'
                );

                try {
                    if (bouton) bouton.disabled = true;

                    await ouvrirBase();

                    const identifiant = $("identifiantConnexion")?.value;
                    const motDePasse = $("motDePasseConnexion")?.value;

                    const utilisateur = await U.connecterAvecSupabase(
    identifiant,
    motDePasse
);

formConnexion.reset();

afficherApplication(utilisateur);
                } catch (erreur) {
                    console.error(erreur);

                    if (message) {
                        message.textContent =
                            erreur.message || "Identifiant ou mot de passe incorrect.";
                    }
                } finally {
                    if (bouton) bouton.disabled = false;
                }
            });
        }

        if (boutonDeconnexion && !boutonDeconnexion.dataset.initialise) {
            boutonDeconnexion.dataset.initialise = "oui";

            boutonDeconnexion.addEventListener("click", () => {
                if (!confirm("Voulez-vous vraiment vous déconnecter ?")) {
                    return;
                }

                U.deconnecter()
    .then(() => afficherEcranConnexion())
    .catch(erreur => {
        console.error("Erreur de déconnexion :", erreur);
        afficherEcranConnexion();
    });
            });
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

        if (!pagesBar.includes(nomPage) || !U.aAcces(nomPage)) {
            nomPage = "accueil";
        }

        const page = $("page-" + nomPage);

        if (!page) {
            console.error("Section introuvable : page-" + nomPage);
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
            const element = event.target;

            if (!(element instanceof Element)) return;

            const bouton = element.closest(
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
        if (!U || !U.estConnecte() || !U.aAcces(nomPage)) {
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
                case "synchronisation":
if (
window.BarSynchronisation &&
typeof window.BarSynchronisation
.afficherEtatSynchronisation === "function"
) {
await window.BarSynchronisation
.afficherEtatSynchronisation("contenuPrincipal");
} else {
$("contenuPrincipal").innerHTML =
"<p>Le module de synchronisation n'est pas chargé.</p>";
}
break;

                case "sauvegarde":
                    if (typeof window.afficherPanneauSauvegardeBar === "function") {
                        window.afficherPanneauSauvegardeBar(
                            $("page-sauvegarde")
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
} else {
$("contenuPrincipal").innerHTML =
"<p>Le module de synchronisation n'est pas chargé.</p>";
}
break;
                case "utilisateurs":
                    if (typeof U.afficherGestionUtilisateurs === "function") {
                        await U.afficherGestionUtilisateurs(
                            $("contenuUtilisateurs")
                        );
                    }
                    break;
            }
        } catch (erreur) {
            console.error("Erreur sur la page " + nomPage + " :", erreur);

            const message = $("messageParametres");

            if (message) {
                message.textContent =
                    "Erreur : " + (erreur.message || String(erreur));
            }
        }
    }

    /* ==========================================
       TABLEAU DE BORD
       ========================================== */

    async function actualiserStatistiques() {
        if (!U || !U.estConnecte() || !U.aAcces("accueil")) return;

        try {
            const [ventes, depenses, produits] = await Promise.all([
                lireTous("ventes"),
                lireTous("depenses"),
                lireTous("produits")
            ]);

            const aujourdHui = dateLocale(new Date());

            const ventesDuJour = (ventes || []).filter(vente => {
                const statut = String(vente.statut || "").toLowerCase();

                if ([
                    "annulée", "annulee", "annulé", "annule",
                    "supprimée", "supprimee"
                ].includes(statut)) {
                    return false;
                }

                return dateLocale(vente.date || vente.dateCreation) === aujourdHui;
            });

            const depensesDuJour = (depenses || []).filter(depense =>
                dateLocale(depense.date || depense.dateCreation) === aujourdHui
            );

            const chiffreAffaires = ventesDuJour.reduce(
                (total, vente) => total + (Number(vente.total) || 0),
                0
            );

            const totalDepenses = depensesDuJour.reduce(
                (total, depense) => total + (Number(depense.montant) || 0),
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

                    const prixVente = Number(ligne.prixUnitaire) || 0;
                    const prixAchat = produit
                        ? Number(produit.prixAchat) || 0
                        : 0;
                    const quantite = Number(ligne.quantite) || 0;

                    beneficeBrut += (prixVente - prixAchat) * quantite;
                });
            });

            const listeProduits = produits || [];

            const ruptures = listeProduits.filter(produit =>
                (Number(produit.quantiteStock) || 0) <= 0
            );

            const stocksFaibles = listeProduits.filter(produit => {
                const quantite = Number(produit.quantiteStock) || 0;
                const seuil = Number(produit.seuilAlerte) || 5;

                return quantite > 0 && quantite <= seuil;
            });

            mettreAJour("statVentes", formaterFCFA(chiffreAffaires));
            mettreAJour("statDepenses", formaterFCFA(totalDepenses));
            mettreAJour("statBenefice", formaterFCFA(beneficeBrut));
            mettreAJour("statProduits", listeProduits.length);
            mettreAJour("statRuptures", ruptures.length);
            mettreAJour("statStockFaible", stocksFaibles.length);

            afficherGraphiqueVentes(ventesDuJour);
        } catch (erreur) {
            console.error("Erreur du tableau de bord :", erreur);
        }
    }

    function afficherGraphiqueVentes(ventes) {
        const conteneur = $("graphiqueVentes");

        if (!conteneur) return;

        const jours = [];

        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setHours(12, 0, 0, 0);
            date.setDate(date.getDate() - i);

            jours.push({
                cle: dateLocale(date),
                nom: date.toLocaleDateString("fr-FR", {
                    weekday: "short"
                }).replace(".", ""),
                montant: 0
            });
           }


        (ventes || []).forEach(vente => {
            const cle = dateLocale(vente.date || vente.dateCreation);
            const jour = jours.find(element => element.cle === cle);

            if (jour) {
                jour.montant += Number(vente.total) || 0;
            }
        });

        const maximum = Math.max(1, ...jours.map(jour => jour.montant));

        conteneur.innerHTML = "";

        const zone = document.createElement("div");

        zone.style.cssText =
            "display:flex;align-items:flex-end;justify-content:space-around;" +
            "gap:8px;width:100%;padding:12px 4px;overflow:hidden";

        jours.forEach(jour => {
            const colonne = document.createElement("div");

            colonne.style.cssText =
                "flex:1;min-width:0;display:flex;flex-direction:column;" +
                "align-items:center;justify-content:flex-end;height:190px;gap:7px";

            colonne.title = jour.nom + " : " + formaterFCFA(jour.montant);

            const montant = document.createElement("span");
            montant.style.cssText =
                "font-size:10px;text-align:center;overflow-wrap:anywhere";
            montant.textContent = jour.montant.toLocaleString("fr-FR");

            const barre = document.createElement("div");
            barre.style.cssText =
                "width:70%;max-width:42px;background:#d4af37;" +
                "border-radius:5px 5px 0 0;min-height:2px";

            barre.style.height = (
                jour.montant > 0
                    ? Math.max(4, jour.montant / maximum * 130)
                    : 2
            ) + "px";

            const nom = document.createElement("span");
            nom.style.cssText = "font-size:11px;text-align:center";
            nom.textContent = jour.nom;

            colonne.append(montant, barre, nom);
            zone.appendChild(colonne);
        });

        conteneur.appendChild(zone);

        const legende = document.createElement("p");
        legende.style.cssText =
            "text-align:center;font-size:12px;color:#bdbdbd;margin:0 0 8px";
        legende.textContent =
            "Chiffre d'affaires — 7 derniers jours";

        conteneur.appendChild(legende);
    }

    /* ==========================================
       DÉMARRAGE DE L'APPLICATION
       ========================================== */

    async function initialiserApplication() {
        if (demarrageEnCours) return;

        demarrageEnCours = true;

        try {
            if (typeof ouvrirBase !== "function") {
                throw new Error("La fonction ouvrirBase() est introuvable.");
            }

            await ouvrirBase();

            if (!U) {
                throw new Error("Le module utilisateurs.js n'est pas chargé.");
            }

            initialiserAuthentification();
            initialiserNavigation();

            const boutonActualiser = $("actualiserTableauBord");

            if (
                boutonActualiser &&
                !boutonActualiser.dataset.initialise
            ) {
                boutonActualiser.dataset.initialise = "oui";

                boutonActualiser.addEventListener(
                    "click",
                    actualiserStatistiques
                );
            }

            const sessionValide = await U.restaurerSession();

            if (sessionValide) {
                afficherApplication();
            } else {
                await afficherEcranConnexion();
            }
        } catch (erreur) {
            console.error("Erreur d'initialisation :", erreur);

            await afficherEcranConnexion();
        } finally {
            demarrageEnCours = false;
        }

        console.log("SAINT-AMOUR BAR PRO : initialisation terminée.");
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initialiserApplication,
            { once: true }
        );
    } 
})();
initialiserAuthentification
 
