"use strict";

/* ==========================================
   CHATGPT BAR PRO
   MODULE COMPLET DES VENTES
   Panier, encaissement, stock et ticket
   ========================================== */

let panierVente = [];
let encaissementEnCours = false;
let derniereVenteImprimable = null;

/* Raccourci HTML */
function elementVente(id) {
    return document.getElementById(id);
}

/* Afficher un message */
function messageVente(texte, erreur = false) {
    const zone = elementVente("messageVente");

    if (!zone) return;

    zone.textContent = texte;
    zone.style.color = erreur ? "#ff5252" : "#19c37d";
}

/* Formater les montants */
function formaterFCFA(montant) {
    return new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 0
    }).format(Number(montant) || 0) + " FCFA";
}

/* Sécuriser le texte */
function echapperTexte(texte) {
    return String(texte ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caractere]);
}

/* ==========================================
   RECHERCHER UN PRODUIT
   ========================================== */

async function rechercherProduitVente(code) {
    const codeRecherche = String(code || "").trim();

    if (!codeRecherche) {
        messageVente("Saisissez ou scannez un code-barres.", true);
        return null;
    }

    try {
        const produit = await rechercherParCode(codeRecherche);

        if (!produit) {
            messageVente(
                "Produit introuvable : " + codeRecherche,
                true
            );
            return null;
        }

        if (Number(produit.quantiteStock) <= 0) {
            messageVente("Ce produit est en rupture de stock.", true);
            return null;
        }

        return produit;

    } catch (erreur) {
        console.error("Erreur de recherche :", erreur);
        messageVente(
            "Erreur lors de la recherche du produit.",
            true
        );
        return null;
    }
}

/* ==========================================
   AJOUTER AU PANIER
   ========================================== */

async function ajouterProduitAuPanier() {
    const champCode = elementVente("codeProduit");
    const champQuantite = elementVente("quantiteVente");

    if (!champCode || !champQuantite) {
        console.error("Champs de vente introuvables.");
        return;
    }

    const code = champCode.value.trim();
    const quantite = Number(champQuantite.value);

    if (!code) {
        messageVente("Saisissez ou scannez le code-barres.", true);
        champCode.focus();
        return;
    }

    if (!Number.isInteger(quantite) || quantite <= 0) {
        messageVente("Saisissez une quantité entière valide.", true);
        return;
    }

    try {
        const produit = await rechercherProduitVente(code);

        if (!produit) return;

        const prix = Number(produit.prixVente);
        const stock = Number(produit.quantiteStock);

        if (!Number.isFinite(prix) || prix < 0) {
            messageVente("Le prix de vente du produit est invalide.", true);
            return;
        }

        const ligneExistante = panierVente.find(
            ligne => String(ligne.idProduit) === String(produit.id)
        );

        const quantiteExistante = ligneExistante
            ? ligneExistante.quantite
            : 0;

        if (quantiteExistante + quantite > stock) {
            messageVente(
                "Stock insuffisant. Quantité disponible : " + stock,
                true
            );
            return;
        }

        if (ligneExistante) {
            ligneExistante.quantite += quantite;
            ligneExistante.sousTotal =
                ligneExistante.prixUnitaire *
                ligneExistante.quantite;

        } else {
            panierVente.push({
                idProduit: produit.id,
                nom: produit.nom,
                codeBarres: produit.codeBarres || code,
                prixUnitaire: prix,
                quantite: quantite,
                sousTotal: prix * quantite
            });
        }

        afficherPanierVente();

        champCode.value = "";
        champQuantite.value = "1";
        champCode.focus();

        messageVente("Produit ajouté au panier.");
      

    } catch (erreur) {
        console.error("Erreur d'ajout au panier :", erreur);

        messageVente(
            "Impossible d'ajouter le produit : " +
            (erreur.message || "erreur inconnue"),
            true
        );
    }
}

/* ==========================================
   AFFICHER LE PANIER
   ========================================== */

function afficherPanierVente() {
    const zone = elementVente("lignesPanier");

    if (!zone) return;

    if (panierVente.length === 0) {
        zone.innerHTML = `
            <tr>
                <td colspan="5">Le panier est vide.</td>
            </tr>
        `;

        actualiserTotalVente();
        return;
    }

    zone.innerHTML = panierVente.map((ligne, index) => `
        <tr>
            <td>${echapperTexte(ligne.nom)}</td>

            <td>
                <input
                    type="number"
                    min="1"
                    step="1"
                    value="${ligne.quantite}"
                    onchange="modifierQuantitePanier(${index}, this.value)"
                    style="width:70px"
                >
            </td>

            <td>${formaterFCFA(ligne.prixUnitaire)}</td>

            <td>${formaterFCFA(
                ligne.prixUnitaire * ligne.quantite
            )}</td>

            <td>
                <button
                    type="button"
                    onclick="retirerDuPanier(${index})"
                >
                    Retirer
                </button>
            </td>
        </tr>
    `).join("");

    actualiserTotalVente();
}

/* ==========================================
   MODIFIER UNE QUANTITÉ
   ========================================== */

async function modifierQuantitePanier(index, valeur) {
    const ligne = panierVente[index];

    if (!ligne) return;

    const quantite = Number(valeur);

    if (!Number.isInteger(quantite) || quantite <= 0) {
        messageVente("Quantité invalide.", true);
        afficherPanierVente();
        return;
    }

    try {
        const produit = await lireParId(
            "produits",
            ligne.idProduit
        );

        if (!produit) {
            messageVente("Produit introuvable dans le stock.", true);
            return;
        }

        if (quantite > Number(produit.quantiteStock)) {
            messageVente(
                "Stock insuffisant. Disponible : " +
                produit.quantiteStock,
                true
            );

            afficherPanierVente();
            return;
        }
        ligne.quantite = quantite;
        ligne.sousTotal = ligne.prixUnitaire *quantite ;

        afficherPanierVente();
        messageVente("Quantité mise à jour.");

    } catch (erreur) {
        console.error(erreur);
        messageVente("Erreur lors de la modification.", true);
    }
}

/* Retirer un article */
function retirerDuPanier(index) {
    panierVente.splice(index, 1);

    afficherPanierVente();

    messageVente("Produit retiré du panier.");
}

/* Calculer le total */
function calculerTotalPanier() {
    return panierVente.reduce(
        (total, ligne) =>
            total + Number(ligne.prixUnitaire) * Number(ligne.quantite),
        0
    );
}

/* Actualiser le total */
function actualiserTotalVente() {
    const total = calculerTotalPanier();
    const zoneTotal = elementVente("totalPanier");

    if (zoneTotal) {
        zoneTotal.textContent = formaterFCFA(total);
    }

    calculerMonnaieVente();
}

/* Calculer la monnaie */
function calculerMonnaieVente() {
    const total = calculerTotalPanier();

    const montantPaye = Number(
        elementVente("montantPaye")?.value
    ) || 0;

    const zoneMonnaie = elementVente("monnaie");

    if (!zoneMonnaie) return;

    if (montantPaye >= total) {
        zoneMonnaie.textContent = formaterFCFA(
            montantPaye - total
        );
    } else {
        zoneMonnaie.textContent =
            "Reste à payer : " +
            formaterFCFA(total - montantPaye);
    }
}

/* Vider le panier */
function viderPanierVente() {
    panierVente = [];

    if (elementVente("montantPaye")) {
        elementVente("montantPaye").value = "";
    }

    afficherPanierVente();
}

/* ==========================================
   ENCAISSER UNE VENTE
   ========================================== */

async function encaisserVente() {
    if (encaissementEnCours) {
        messageVente("Un encaissement est déjà en cours.", true);
        return;
    }

    if (panierVente.length === 0) {
        messageVente("Le panier est vide.", true);
        return;
    }

    const total = calculerTotalPanier();

    const montantPaye = Number(
        elementVente("montantPaye")?.value
    );

    if (
        !Number.isFinite(montantPaye) ||
        montantPaye < total
    ) {
        messageVente("Le montant reçu est insuffisant.", true);
        return;
    }

    const confirmation = window.confirm(
        "Confirmer l'encaissement de " +
        formaterFCFA(total) + " ?\n\n" +
        "La vente sera enregistrée et le stock diminuera."
    );

    if (!confirmation) return;

    encaissementEnCours = true;

    const bouton = elementVente("encaisser");

    if (bouton) bouton.disabled = true;

    /* Garder une copie du panier pendant l'opération */
    const panierAEncaisser = panierVente.map(ligne => ({
        ...ligne
    }));

    try {
        const db = await ouvrirBase();

        /* Préparer les données de vente */
        const lignes = panierAEncaisser.map(ligne => ({
            idProduit: ligne.idProduit,
            nom: ligne.nom,
            codeBarres: ligne.codeBarres || "",
            prixUnitaire: Number(ligne.prixUnitaire),
            quantite: Number(ligne.quantite),
            sousTotal:
                Number(ligne.prixUnitaire) *
                Number(ligne.quantite)
        }));

        const vente = {
            numero: "V-" + Date.now(),
            date: new Date().toISOString(),
            lignes: lignes,
            total: total,
            montantPaye: montantPaye,
            monnaie: montantPaye - total,
            modePaiement: "Espèces",
            statut: "validée"
        };

        /* Enregistrer la vente et diminuer le stock
           dans une seule transaction IndexedDB. */

        await new Promise((resolve, reject) => {
            const transaction = db.transaction(
                ["produits", "ventes"],
                "readwrite"
            );

            const magasinProduits =
                transaction.objectStore("produits");

            const magasinVentes =
                transaction.objectStore("ventes");

            let erreurValidation = null;
            let nombreTraites = 0;
            let venteEnregistree = false;

            transaction.oncomplete = function () {
                if (venteEnregistree) {
                    resolve();
                } else {
                    reject(
                        new Error(
                            "La vente n'a pas été enregistrée."
                        )
                    );
                }
            };

            transaction.onerror = function () {
                reject(
                    erreurValidation ||
                    transaction.error ||
                    new Error("Erreur pendant l'encaissement.")
                );
            };

            transaction.onabort = function () {
                reject(
                    erreurValidation ||
                    transaction.error ||
                    new Error("L'encaissement a été annulé.")
                );
            };

            lignes.forEach(ligne => {
                const demande = magasinProduits.get(
                    ligne.idProduit
                );

                demande.onsuccess = function () {
                    const produit = demande.result;

                    if (!produit) {
                        erreurValidation = new Error(
                            "Produit introuvable : " + ligne.nom
                        );

                        transaction.abort();
                        return;
                    }

                    const stockActuel =
                        Number(produit.quantiteStock);

                    if (
                        !Number.isFinite(stockActuel) ||
                        stockActuel < ligne.quantite
                    ) {
                        erreurValidation = new Error(
                            "Stock insuffisant pour : " +
                            produit.nom
                        );

                        transaction.abort();
                        return;
                    }

                    produit.quantiteStock =
                        stockActuel - ligne.quantite;

                    magasinProduits.put(produit);

                    nombreTraites++;

                    if (
                        nombreTraites === lignes.length &&
                        !erreurValidation
                    ) {
                        const demandeVente =
                            magasinVentes.add(vente);

                        demandeVente.onsuccess = function () {
                            venteEnregistree = true;
                        };

                        demandeVente.onerror = function () {
                            erreurValidation = new Error(
                                "Impossible d'enregistrer la vente."
                            );

                            transaction.abort();
                        };
                    }
                };

                demande.onerror = function () {
                    erreurValidation = new Error(
                        "Impossible de vérifier le stock."
                    );

                    transaction.abort();
                };
            });
        });

        /* La transaction est terminée avec succès :
           conserver le vrai ticket enregistré. */

        derniereVenteImprimable = {
            ...vente,
            lignes: lignes.map(ligne => ({ ...ligne }))
        };

        const boutonTicket = elementVente("imprimerTicket");

        if (boutonTicket) {
            boutonTicket.disabled = false;
        }

        /* Vider le panier seulement après réussite */
        panierVente = [];

        const champPaye = elementVente("montantPaye");

        if (champPaye) {
            champPaye.value = "";
        }

        afficherPanierVente();

        messageVente(
            "Vente encaissée avec succès : " +
            formaterFCFA(total)
        );
      // Imprimer automatiquement le ticket après la vente
setTimeout(() => {
    imprimerDernierTicket();
}, 500);

        /* Actualiser le stock et la caisse */
        if (typeof afficherStock === "function") {
            await afficherStock();
        }

        if (typeof afficherHistoriqueCaisse === "function") {
            await afficherHistoriqueCaisse();
        }

        if (typeof actualiserStatistiques === "function") {
            await actualiserStatistiques();
        }

    } catch (erreur) {
        console.error("Erreur d'encaissement :", erreur);

        messageVente(
            erreur.message || "L'encaissement a échoué.",
            true
        );

    } finally {
        encaissementEnCours = false;

        if (bouton) {
            bouton.disabled = false;
        }
    }
}

/* ==========================================
   IMPRIMER LE DERNIER TICKET
   ========================================== */

function imprimerDernierTicket() {
    if (!derniereVenteImprimable) {
        alert("Aucune vente validée à imprimer.");
        return;
    }

    const vente = derniereVenteImprimable;

    const lignesHTML = vente.lignes.map(ligne => `
        <tr>
            <td>${echapperTexte(ligne.nom)}</td>
            <td>${ligne.quantite}</td>
            <td>${formaterFCFA(ligne.prixUnitaire)}</td>
            <td>${formaterFCFA(ligne.sousTotal)}</td>
        </tr>
    `).join("");

    const fenetre = window.open(
        "",
        "_blank",
        "width=400,height=700"
    );

    if (!fenetre) {
        alert(
            "Fenêtre bloquée. Autorisez les fenêtres " +
            "contextuelles dans Chrome."
        );
        return;
    }

    const dateVente = new Date(vente.date).toLocaleString("fr-FR");

    fenetre.document.write(`
        <!DOCTYPE html>
        <html lang="fr">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport"
                  content="width=device-width, initial-scale=1">
            <title>Ticket de caisse</title>

            <style>
                @page {
                    size: 80mm auto;
                    margin: 3mm;
                }

                body {
                    font-family: Arial, sans-serif;
                    width: 72mm;
                    margin: 0 auto;
                    color: #000;
                    font-size: 11px;
                }

                h2, p {
                    text-align: center;
                    margin: 5px 0;
                }

                h2 {
                    font-size: 18px;
                }

                .separateur {
                    border-top: 1px dashed #000;
                    margin: 8px 0;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10px;
                }

                th, td {
                    padding: 4px 1px;
                    text-align: left;
                    overflow-wrap: anywhere;
                }

                .total {
                    font-size: 14px;
                    font-weight: bold;
                }
            </style>
        </head>

        <body>
            <h2>SAINT-AMOUR BAR PRO</h2>
            <p>Ticket de caisse</p>

            <div class="separateur"></div>

            <p>Numéro : ${echapperTexte(vente.numero)}</p>
            <p>Date : ${echapperTexte(dateVente)}</p>

            <div class="separateur"></div>

            <table>
                <thead>
                    <tr>
                        <th>Produit</th>
                        <th>Qté</th>
                        <th>Prix</th>
                        <th>Total</th>
                    </tr>
                </thead>
                <tbody>${lignesHTML}</tbody>
            </table>

            <div class="separateur"></div>

            <p class="total">
                TOTAL : ${formaterFCFA(vente.total)}
            </p>

            <p>Montant reçu : ${formaterFCFA(vente.montantPaye)}</p>
            <p>Monnaie rendue : ${formaterFCFA(vente.monnaie)}</p>

            <div class="separateur"></div>

            <p>Merci de votre visite !</p>
            <p>À bientôt.</p>

            <script>
                window.onload = function () {
                    setTimeout(function () {
                        window.print();
                    }, 300);
                };
            <\/script>
        </body>
        </html>
    `);

    fenetre.document.close();
}

/* ==========================================
   INITIALISATION DES BOUTONS
   ========================================== */

function initialiserModuleVentes() {
    const boutonAjouter = elementVente("ajouterPanier");
    const champCode = elementVente("codeProduit");
    const champPaye = elementVente("montantPaye");
    const boutonEncaisser = elementVente("encaisser");
    const boutonTicket = elementVente("imprimerTicket");

    if (boutonAjouter) {
        boutonAjouter.addEventListener(
            "click",
            ajouterProduitAuPanier
        );
    }

    if (champCode) {
        champCode.addEventListener("keydown", event => {
            if (event.key === "Enter") {
                event.preventDefault();
                ajouterProduitAuPanier();
            }
        });
    }

    if (champPaye) {
        champPaye.addEventListener(
            "input",
            calculerMonnaieVente
        );
    }

    if (boutonEncaisser) {
        boutonEncaisser.addEventListener(
            "click",
            encaisserVente
        );
    }

    if (boutonTicket) {
        boutonTicket.addEventListener(
            "click",
            imprimerDernierTicket
        );
        boutonTicket.disabled = true;
    }

    afficherPanierVente();

    console.log("Module des ventes initialisé.");
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserModuleVentes
    );
} else {
    initialiserModuleVentes();
}