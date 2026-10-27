"use strict";

/* ==========================================
   SAINT-AMOUR BAR PRO
   GESTION DES STOCKS
   ========================================== */

const SEUIL_ALERTE_STOCK_BAR = 5;

function montantStockBar(valeur) {
    return new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 0
    }).format(Number(valeur) || 0) + " FCFA";
}

function securiserStockBar(valeur) {
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

async function obtenirProduitsStockBar() {
    const produits = await lireTous("produits");

    return Array.isArray(produits) ? produits : [];
}

/* Historique local des mouvements de stock */
function lireHistoriqueStockBar() {
    try {
        const texte = localStorage.getItem(
            "chatgptBarProHistoriqueStock"
        );

        const resultat = texte ? JSON.parse(texte) : [];

        return Array.isArray(resultat) ? resultat : [];
    } catch (erreur) {
        console.error("Erreur historique stock :", erreur);
        return [];
    }
}

function enregistrerHistoriqueStockBar(mouvement) {
    try {
        const historique = lireHistoriqueStockBar();

        historique.unshift(mouvement);

        /* Limiter la taille de l'historique */
        const limite = historique.slice(0, 500);

        localStorage.setItem(
            "chatgptBarProHistoriqueStock",
            JSON.stringify(limite)
        );

        return true;
    } catch (erreur) {
        console.error("Historique stock non enregistré :", erreur);

        alert(
            "Attention : le mouvement sera appliqué au stock, " +
            "mais son historique n'a pas pu être sauvegardé."
        );

        return false;
    }
}

/* Afficher les stocks et le formulaire */
async function afficherStockBar() {
    const zone = document.getElementById("listeStock");

    if (!zone) {
        console.error("Élément listeStock introuvable.");
        return;
    }

    try {
        const produits = await obtenirProduitsStockBar();

        const nombreProduits = produits.length;

        const quantiteTotale = produits.reduce(
            (total, produit) =>
                total + Math.max(
                    0,
                    Number(produit.quantiteStock) || 0
                ),
            0
        );

        const valeurAchat = produits.reduce(
            (total, produit) =>
                total +
                (Number(produit.prixAchat) || 0) *
                (Number(produit.quantiteStock) || 0),
            0
        );

        const stocksFaibles = produits.filter(produit =>
            Number(produit.quantiteStock) <=
            SEUIL_ALERTE_STOCK_BAR
        );

        zone.innerHTML = `
            <h3>📦 Gestion des stocks</h3>

            <div class="statistiques">
                <article class="carte">
                    <h3>Produits référencés</h3>
                    <p>${nombreProduits}</p>
                </article>

                <article class="carte">
                    <h3>Quantité totale</h3>
                    <p>${quantiteTotale}</p>
                </article>

                <article class="carte">
                    <h3>Valeur d'achat</h3>
                    <p>${montantStockBar(valeurAchat)}</p>
                </article>

                <article class="carte">
                    <h3>Stocks faibles</h3>
                    <p>${stocksFaibles.length}</p>
                </article>
            </div>

            <h3>📥 Entrée ou sortie de stock</h3>

            <form id="formMouvementStockBar">
                <label for="produitMouvementStockBar">
                    Produit
                </label>

                <select
                    id="produitMouvementStockBar"
                    required
                >
                    <option value="">Choisir un produit</option>

                    ${produits.map(produit => `
                        <option value="${securiserStockBar(produit.id)}">
                            ${securiserStockBar(produit.nom)}
                            — Stock :
                            ${Number(produit.quantiteStock) || 0}
                        </option>
                    `).join("")}
                </select>

                <label for="typeMouvementStockBar">
                    Type de mouvement
                </label>

                <select
                    id="typeMouvementStockBar"
                    required
                >
                    <option value="entree">Entrée de stock</option>
                    <option value="sortie">Sortie de stock</option>
                </select>

                <label for="quantiteMouvementStockBar">
                    Quantité
                </label>

                <input
                    type="number"
                    id="quantiteMouvementStockBar"
                    min="1"
                    step="1"
                    required
                    placeholder="Ex. : 10"
                >

                <label for="motifMouvementStockBar">
                    Motif
                </label>

                <select
                    id="motifMouvementStockBar"
                    required
                >
                    <option value="Approvisionnement">
                        Approvisionnement
                    </option>
                    <option value="Retour client">
                        Retour client
                    </option>
                    <option value="Perte">
                        Perte
                    </option>
                    <option value="Produit endommagé">
                        Produit endommagé
                    </option>
                    <option value="Correction inventaire">
                        Correction d'inventaire
                    </option>
                    <option value="Autre">
                        Autre
                    </option>
                </select>

                <button type="submit">
                    Enregistrer le mouvement
                </button>

                <p id="messageMouvementStockBar"
                   aria-live="polite"></p>
            </form>

            <h3>⚠️ Alertes de stock</h3>

            ${
                stocksFaibles.length === 0
                    ? "<p>Aucun stock faible.</p>"
                    : stocksFaibles.map(produit => `
                        <div class="alerte-stock">
                            <strong>
                                ${securiserStockBar(produit.nom)}
                            </strong>
                            — Stock restant :
                            ${Number(produit.quantiteStock) || 0}
                        </div>
                    `).join("")
            }

            <h3>📋 État détaillé du stock</h3><button type="button" id="imprimerStockBar">
    🖨️ Imprimer l'état du stock
</button>

            ${
                produits.length === 0
                    ? "<p>Aucun produit enregistré.</p>"
                    : `
                        <div class="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Produit</th>
                                        <th>Stock</th>
                                        <th>Prix d'achat</th>
                                        <th>Valeur du stock</th>
                                        <th>État</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    ${produits.map(produit => {
                                        const stock = Math.max(
                                            0,
                                            Number(produit.quantiteStock) || 0
                                        );

                                        const valeur =
                                            stock *
                                            (Number(produit.prixAchat) || 0);

                                        const etat = stock === 0
                                            ? "Épuisé"
                                            : stock <= SEUIL_ALERTE_STOCK_BAR
                                                ? "Stock faible"
                                                : "Disponible";

                                        return `
                                            <tr>
                                                <td>
                                                    ${securiserStockBar(
                                                        produit.nom
                                                    )}
                                                </td>

                                                <td>${stock}</td>

                                                <td>
                                                    ${montantStockBar(
                                                        produit.prixAchat
                                                    )}
                                                </td>

                                                <td>
                                                    ${montantStockBar(valeur)}
                                                </td>

                                                <td>${etat}</td>
                                            </tr>
                                        `;
                                    }).join("")}
                                </tbody>
                            </table>
                        </div>
                    `
            }

            <h3>🕘 Historique des mouvements</h3>

            <div id="historiqueMouvementsStockBar"></div>
        `;

        afficherHistoriqueStockBar();

        const formulaire = document.getElementById(
            "formMouvementStockBar"
        );

        formulaire?.addEventListener(
            "submit",
            enregistrerMouvementStockBar
        );

    } catch (erreur) {
        console.error("Erreur affichage stock :", erreur);

        zone.innerHTML = `
            <p>Impossible de charger les stocks.</p>
            <p>${securiserStockBar(erreur.message)}</p>
        `;
    }
}

/* Enregistrer une entrée ou une sortie */
async function enregistrerMouvementStockBar(evenement) {
    evenement.preventDefault();

    const selectProduit = document.getElementById(
        "produitMouvementStockBar"
    );

    const selectType = document.getElementById(
        "typeMouvementStockBar"
    );

    const champQuantite = document.getElementById(
        "quantiteMouvementStockBar"
    );

    const selectMotif = document.getElementById(
        "motifMouvementStockBar"
    );

    const message = document.getElementById(
        "messageMouvementStockBar"
    );

    if (
        !selectProduit ||
        !selectType ||
        !champQuantite ||
        !selectMotif
    ) {
        alert("Formulaire de mouvement incomplet.");
        return;
    }

    const id = selectProduit.value;
    const type = selectType.value;
    const quantite = Number(champQuantite.value);
    const motif = selectMotif.value;

    if (!id) {
        alert("Sélectionnez un produit.");
        return;
    }

    if (
        !Number.isInteger(quantite) ||
        quantite <= 0
    ) {
        alert("La quantité doit être un entier supérieur à zéro.");
        return;
    }

    if (!["entree", "sortie"].includes(type)) {
        alert("Type de mouvement invalide.");
        return;
    }

    try {
        const produits = await obtenirProduitsStockBar();

        const produit = produits.find(element =>
            String(element.id) === String(id)
        );

        if (!produit) {
            alert("Produit introuvable.");
            return;
        }

        const stockActuel = Math.max(
            0,
            Number(produit.quantiteStock) || 0
        );

        if (
            type === "sortie" &&
            quantite > stockActuel
        ) {
            alert(
                "Stock insuffisant.\n" +
                "Stock disponible : " + stockActuel
            );
            return;
        }

        const nouveauStock = type === "entree"
            ? stockActuel + quantite
            : stockActuel - quantite;

        const produitModifie = {
            ...produit,
            quantiteStock: nouveauStock
        };

        await modifierEnregistrement(
            "produits",
            produitModifie
        );

        enregistrerHistoriqueStockBar({
            produitId: produit.id,
            nomProduit: produit.nom,
            type,
            quantite,
            ancienStock: stockActuel,
            nouveauStock,
            motif,
            date: new Date().toISOString()
        });

        const formulaire = document.getElementById(
            "formMouvementStockBar"
        );

        formulaire?.reset();

        if (message) {
            message.textContent =
                "Mouvement enregistré. Nouveau stock : " +
                nouveauStock;
        }

        await afficherStockBar();

        if (typeof afficherProduitsBar === "function") {
            await afficherProduitsBar();
        }

        if (typeof actualiserStatistiques === "function") {
            await actualiserStatistiques();
        }

        alert(
            "Mouvement enregistré avec succès !\n" +
            "Nouveau stock de " + produit.nom + " : " +
            nouveauStock
        );

    } catch (erreur) {
        console.error("Erreur mouvement stock :", erreur);

        alert(
            "Impossible d'enregistrer le mouvement : " +
            (erreur.message || String(erreur))
        );
    }
}

/* Afficher l'historique des mouvements */
function afficherHistoriqueStockBar() {
    const zone = document.getElementById(
        "historiqueMouvementsStockBar"
    );

    if (!zone) return;

    const historique = lireHistoriqueStockBar();

    if (historique.length === 0) {
        zone.innerHTML =
            "<p>Aucun mouvement de stock enregistré.</p>";
        return;
    }

    zone.innerHTML = `
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Produit</th>
                        <th>Type</th>
                        <th>Quantité</th>
                        <th>Ancien stock</th>
                        <th>Nouveau stock</th>
                        <th>Motif</th>
                    </tr>
                </thead>

                <tbody>
                    ${historique.map(mouvement => `
                        <tr>
                            <td>
                                ${securiserStockBar(
                                    new Date(mouvement.date)
                                        .toLocaleString("fr-FR")
                                )}
                            </td>

                            <td>
                                ${securiserStockBar(
                                    mouvement.nomProduit
                                )}
                            </td>

                            <td>
                                ${
                                    mouvement.type === "entree"
                                        ? "Entrée"
                                        : "Sortie"
                                }
                            </td>

                            <td>${Number(mouvement.quantite) || 0}</td>

                            <td>
                                ${Number(mouvement.ancienStock) || 0}
                            </td>

                            <td>
                                ${Number(mouvement.nouveauStock) || 0}
                            </td>

                            <td>
                                ${securiserStockBar(mouvement.motif)}
                            </td>
                        </tr>
                    `).join("")}
                </tbody>
            </table>
        </div>
    `;
}

/* Initialiser le module */
function initialiserStockBar() {
    afficherStockBar().catch(console.error);
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserStockBar,
        { once: true }
    );
} else {
    initialiserStockBar();
}
/* ==========================================
IMPRESSION DE L'ETAT DU STOCK
========================================== */

async function imprimerStockBar() {
try {
const produits = await obtenirProduitsStockBar();

    const dateImpression = new Date().toLocaleString("fr-FR");

    const quantiteTotale = produits.reduce(
        (total, produit) =>
            total + Math.max(
                0,
                Number(produit.quantiteStock) || 0
            ),
        0
    );

    const valeurTotale = produits.reduce(
        (total, produit) =>
            total +
            Math.max(0, Number(produit.quantiteStock) || 0) *
            Math.max(0, Number(produit.prixAchat) || 0),
        0
    );

    const lignes = produits.map(produit => {
        const quantite = Math.max(
            0,
            Number(produit.quantiteStock) || 0
        );

        const prixAchat = Math.max(
            0,
            Number(produit.prixAchat) || 0
        );

        const valeur = quantite * prixAchat;

        const etat = quantite === 0
            ? "Épuisé"
            : quantite <= SEUIL_ALERTE_STOCK_BAR
                ? "Stock faible"
                : "Disponible";

        return `
            <tr>
                <td>${securiserStockBar(produit.nom)}</td>
                <td>${quantite}</td>
                <td>${montantStockBar(prixAchat)}</td>
                <td>${montantStockBar(valeur)}</td>
                <td>${etat}</td>
            </tr>
        `;
    }).join("");

    const fenetre = window.open("", "_blank");

    if (!fenetre) {
        alert(
            "Impression bloquée. Autorise les fenêtres " +
            "contextuelles dans Chrome, puis réessaie."
        );
        return;
    }

    fenetre.document.open();

    fenetre.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1">
            <title>État du stock - SAINT-AMOUR BAR</title>

            <style>
                body {
                    font-family: Arial, sans-serif;
                    color: #111;
                    margin: 20px;
                    font-size: 12px;
                }

                header {
                    text-align: center;
                    border-bottom: 2px solid #222;
                    padding-bottom: 12px;
                    margin-bottom: 20px;
                }

                h1 { margin-bottom: 5px; }
                h2 { margin-top: 25px; }

                .resume {
                    display: flex;
                    justify-content: space-between;
                    flex-wrap: wrap;
                    gap: 12px;
                    margin-bottom: 20px;
                }

                .resume div {
                    border: 1px solid #777;
                    padding: 10px;
                    flex: 1;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 12px;
                }

                th, td {
                    border: 1px solid #777;
                    padding: 7px;
                    text-align: left;
                }

                th {
                    background: #eee;
                }

                .signature {
                    display: flex;
                    justify-content: space-between;
                    gap: 25px;
                    margin-top: 55px;
                }

                .signature div {
                    width: 45%;
                    border-top: 1px solid #333;
                    padding-top: 8px;
                }

                .actions {
                    margin-bottom: 20px;
                }

                button {
                    padding: 12px 18px;
                    font-size: 15px;
                }

                @page {
                    size: A4 portrait;
                    margin: 12mm;
                }

                @media print {
                    body { margin: 0; }
                    .actions { display: none; }
                    tr { break-inside: avoid; }
                }
            </style>
        </head>

        <body>
            <div class="actions">
                <button onclick="window.print()">
                    Imprimer
                </button>
                <button onclick="window.close()">
                    Fermer
                </button>
            </div>

            <header>
                <h1>SAINT-AMOUR BAR</h1>
                <p>GALABADJA 6</p>
                <p>Téléphone : 72 48 17 48</p>
                <h2>ÉTAT DÉTAILLÉ DU STOCK</h2>
                <p>Date d'impression : ${securiserStockBar(dateImpression)}</p>
            </header>

            <div class="resume">
                <div>
                    <strong>Produits référencés</strong>
                    <p>${produits.length}</p>
                </div>

                <div>
                    <strong>Quantité totale</strong>
                    <p>${quantiteTotale}</p>
                </div>

                <div>
                    <strong>Valeur d'achat du stock</strong>
                    <p>${montantStockBar(valeurTotale)}</p>
                </div>
            </div>

            <table>
                <thead>
                    <tr>
                        <th>Produit</th>
                        <th>Quantité</th>
                        <th>Prix d'achat</th>
                        <th>Valeur du stock</th>
                        <th>État</th>
                    </tr>
                </thead>

                <tbody>
                    ${
                        lignes ||
                        '<tr><td colspan="5">Aucun produit enregistré.</td></tr>'
                    }
                </tbody>
            </table>

            <div class="signature">
                <div>Signature du responsable du stock</div>
                <div>Signature du directeur</div>
            </div>
        </body>
        </html>
    `);

    fenetre.document.close();

} catch (erreur) {
    console.error("Erreur impression du stock :", erreur);

    alert(
        "Impossible de préparer l'impression du stock : " +
        (erreur.message || String(erreur))
    );
}

}

/* Rendre la fonction accessible */
window.imprimerStockBar = imprimerStockBar;

/* Gérer le bouton après affichage du stock */
document.addEventListener("click", evenement => {
const bouton = evenement.target.closest("#imprimerStockBar");

if (!bouton) return;

imprimerStockBar();

});