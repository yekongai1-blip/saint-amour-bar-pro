"use strict";

/* ==========================================
   CHATGPT BAR PRO
   GESTION DES PRODUITS
   Compatible avec le module de vente existant
   ========================================== */

let rechercheProduitBar = "";

function securiserProduitBar(valeur) {
    const caracteres = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    return String(valeur ?? "").replace(
        /[&<>"']/g,
        caractere => caracteres[caractere]
    );
}

function montantProduitBar(valeur) {
    return new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 0
    }).format(Number(valeur) || 0) + " FCFA";
}

async function obtenirProduitsBar() {
    const produits = await lireTous("produits");

    return Array.isArray(produits) ? produits : [];
}

/* Ajouter un produit */
async function enregistrerProduitBar(evenement) {
    evenement.preventDefault();

    const formulaire = document.getElementById("formProduit");

    if (!formulaire) return;

    const champNom = document.getElementById("nomProduit");
    const champCode = document.getElementById("codeNouveauProduit");
    const champCategorie = document.getElementById("categorieProduit");
    const champAchat = document.getElementById("prixAchat");
    const champVente = document.getElementById("prixVente");
    const champStock = document.getElementById("quantiteStock");

    if (
        !champNom ||
        !champAchat ||
        !champVente ||
        !champStock
    ) {
        alert("Certains champs du formulaire sont manquants.");
        return;
    }

    const nom = champNom.value.trim();
    const codeBarres = champCode
        ? champCode.value.trim()
        : "";

    const categorie = champCategorie
        ? champCategorie.value.trim()
        : "";

    const prixAchat = Number(champAchat.value);
    const prixVente = Number(champVente.value);
    const quantiteStock = Number(champStock.value);

    if (!nom) {
        alert("Saisissez le nom du produit.");
        champNom.focus();
        return;
    }

    if (
        !Number.isFinite(prixAchat) ||
        prixAchat < 0 ||
        !Number.isFinite(prixVente) ||
        prixVente < 0
    ) {
        alert("Les prix doivent être des nombres positifs ou nuls.");
        return;
    }

    if (
        !Number.isInteger(quantiteStock) ||
        quantiteStock < 0
    ) {
        alert("La quantité doit être un nombre entier positif ou nul.");
        champStock.focus();
        return;
    }

    try {
        const produits = await obtenirProduitsBar();

        if (
            codeBarres &&
            produits.some(produit =>
                String(produit.codeBarres || "") === codeBarres
            )
        ) {
            alert("Ce code-barres existe déjà.");
            champCode.focus();
            return;
        }

        const produit = {
            nom,
            codeBarres,
            categorie,
            prixAchat,
            prixVente,
            quantiteStock,
            dateCreation: new Date().toISOString()
        };

        await ajouterEnregistrement("produits", produit);

        formulaire.reset();

        await afficherProduitsBar();

        if (typeof afficherStockBar === "function") {
            await afficherStockBar();
        }

        if (typeof actualiserStatistiques === "function") {
            await actualiserStatistiques();
        }

        alert("Produit enregistré avec succès !");
    } catch (erreur) {
        console.error("Erreur produit :", erreur);

        alert(
            "Impossible d'enregistrer le produit : " +
            (erreur.message || String(erreur))
        );
    }
}

/* Modifier un produit */
async function modifierProduitBar(id) {
    try {
        const produits = await obtenirProduitsBar();

        const produit = produits.find(element =>
            String(element.id) === String(id)
        );

        if (!produit) {
            alert("Produit introuvable.");
            return;
        }

        const nom = prompt("Nom du produit :", produit.nom || "");

        if (nom === null) return;

        if (!nom.trim()) {
            alert("Le nom du produit est obligatoire.");
            return;
        }

        const prixAchat = prompt(
            "Prix d'achat en FCFA :",
            String(produit.prixAchat ?? 0)
        );

        if (prixAchat === null) return;

        const prixVente = prompt(
            "Prix de vente en FCFA :",
            String(produit.prixVente ?? 0)
        );

        if (prixVente === null) return;

        const achat = Number(prixAchat);
        const vente = Number(prixVente);

        if (
            !Number.isFinite(achat) ||
            achat < 0 ||
            !Number.isFinite(vente) ||
            vente < 0
        ) {
            alert("Veuillez saisir des prix valides.");
            return;
        }

        const produitModifie = {
            ...produit,
            nom: nom.trim(),
            prixAchat: achat,
            prixVente: vente
        };

        await modifierEnregistrement(
            "produits",
            produitModifie
        );

        await afficherProduitsBar();

        if (typeof afficherStockBar === "function") {
            await afficherStockBar();
        }

        if (typeof actualiserStatistiques === "function") {
            await actualiserStatistiques();
        }

        alert("Produit modifié avec succès !");
    } catch (erreur) {
        console.error("Erreur modification produit :", erreur);

        alert(
            "Impossible de modifier le produit : " +
            (erreur.message || String(erreur))
        );
    }
}

/* Supprimer un produit */
async function supprimerProduitBar(id) {
    const confirmation = confirm(
        "Voulez-vous vraiment supprimer ce produit ?"
    );

    if (!confirmation) return;

    try {
        const produits = await obtenirProduitsBar();

        const produit = produits.find(element =>
            String(element.id) === String(id)
        );

        if (!produit) {
            alert("Produit introuvable.");
            return;
        }

        await supprimerEnregistrement(
            "produits",
            Number(id)
        );

        await afficherProduitsBar();

        if (typeof afficherStockBar === "function") {
            await afficherStockBar();
        }

        if (typeof actualiserStatistiques === "function") {
            await actualiserStatistiques();
        }

        alert("Produit supprimé.");
    } catch (erreur) {
        console.error("Erreur suppression produit :", erreur);

        alert(
            "Impossible de supprimer le produit : " +
            (erreur.message || String(erreur))
        );
    }
}

/* Afficher les produits */
async function afficherProduitsBar() {
    const zone = document.getElementById("listeProduits");

    if (!zone) return;

    try {
        const produits = await obtenirProduitsBar();

        const terme = rechercheProduitBar.toLowerCase();

        const resultat = produits.filter(produit => {
            const nom = String(produit.nom || "").toLowerCase();
            const code = String(
                produit.codeBarres || ""
            ).toLowerCase();

            const categorie = String(
                produit.categorie || ""
            ).toLowerCase();

            return (
                nom.includes(terme) ||
                code.includes(terme) ||
                categorie.includes(terme)
            );
        });

        const valeurStock = resultat.reduce(
            (total, produit) =>
                total +
                (Number(produit.prixAchat) || 0) *
                (Number(produit.quantiteStock) || 0),
            0
        );

        zone.innerHTML = `
            <h3>📦 Catalogue des produits</h3>

            <p>
                Produits affichés :
                <strong>${resultat.length}</strong>
            </p>

            <p>
                Valeur d'achat du stock affiché :
                <strong>${montantProduitBar(valeurStock)}</strong>
            </p>

            <label for="rechercheProduitBar">
                Rechercher un produit
            </label>

            <input
                type="search"
                id="rechercheProduitBar"
                placeholder="Nom, code-barres ou catégorie..."
                value="${securiserProduitBar(rechercheProduitBar)}"
            >

            ${
                resultat.length === 0
                    ? "<p>Aucun produit trouvé.</p>"
                    : `
                        <div class="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Produit</th>
                                        <th>Code</th>
                                        <th>Catégorie</th>
                                        <th>Achat</th>
                                        <th>Vente</th>
                                        <th>Stock</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    ${resultat.map(produit => {
                                        const stock = Number(
                                            produit.quantiteStock
                                        ) || 0;

                                        return `
                                            <tr>
                                                <td>
                                                    ${securiserProduitBar(
                                                        produit.nom
                                                    )}
                                                </td>

                                                <td>
                                                    ${securiserProduitBar(
                                                        produit.codeBarres || "-"
                                                    )}
                                                </td>

                                                <td>
                                                    ${securiserProduitBar(
                                                        produit.categorie || "-"
                                                    )}
                                                </td>

                                                <td>
                                                    ${montantProduitBar(
                                                        produit.prixAchat
                                                    )}
                                                </td>

                                                <td>
                                                    ${montantProduitBar(
                                                        produit.prixVente
                                                    )}
                                                </td>

                                                <td>
                                                    <strong>${stock}</strong>
                                                </td>

                                                <td>
                                                    <button
                                                        type="button"
                                                        data-produit-action="modifier"
                                                        data-produit-id="${securiserProduitBar(produit.id)}">
                                                        Modifier
                                                    </button>

                                                    <button
                                                        type="button"
                                                        data-produit-action="supprimer"
                                                        data-produit-id="${securiserProduitBar(produit.id)}">
                                                        Supprimer
                                                    </button>
                                                </td>
                                            </tr>
                                        `;
                                    }).join("")}
                                </tbody>
                            </table>
                        </div>
                    `
            }
        `;

        const recherche = document.getElementById(
            "rechercheProduitBar"
        );

        recherche?.addEventListener("input", evenement => {
            rechercheProduitBar = evenement.target.value;
            afficherProduitsBar();
        });

    } catch (erreur) {
        console.error("Erreur affichage produits :", erreur);

        zone.innerHTML = `
            <p>Impossible de charger les produits.</p>
            <p>${securiserProduitBar(erreur.message)}</p>
        `;
    }
}

/* Initialiser le module */
function initialiserProduitsBar() {
    const formulaire = document.getElementById("formProduit");
    const zone = document.getElementById("listeProduits");

    if (
        formulaire &&
        formulaire.dataset.produitsInitialises !== "oui"
    ) {
        formulaire.addEventListener(
            "submit",
            enregistrerProduitBar
        );

        formulaire.dataset.produitsInitialises = "oui";
    }

    if (
        zone &&
        zone.dataset.actionsProduitsInitialisees !== "oui"
    ) {
        zone.addEventListener("click", async evenement => {
            const bouton = evenement.target.closest(
                "button[data-produit-action]"
            );

            if (!bouton) return;

            const id = bouton.dataset.produitId;
            const action = bouton.dataset.produitAction;

            if (action === "modifier") {
                await modifierProduitBar(id);
            } else if (action === "supprimer") {
                await supprimerProduitBar(id);
            }
        });

        zone.dataset.actionsProduitsInitialisees = "oui";
    }

    afficherProduitsBar().catch(console.error);
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserProduitsBar,
        { once: true }
    );
} else {
    initialiserProduitsBar();
}
