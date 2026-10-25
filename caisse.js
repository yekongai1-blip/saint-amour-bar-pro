"use strict";

/* ==========================================
   CHATGPT BAR PRO
   MODULE DE GESTION DE CAISSE
   ========================================== */

/* Sécuriser le texte affiché */
function securiserCaisse(valeur) {
    return String(valeur ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caractere]);
}

/* Formater les montants */
function formaterFCCaisse(montant) {
    return new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 0
    }).format(Number(montant) || 0) + " FCFA";
}

/* Formater la date */
function formaterDateCaisse(date) {
    if (!date) return "-";

    const valeur = new Date(date);

    if (Number.isNaN(valeur.getTime())) return "-";

    return valeur.toLocaleString("fr-FR");
}

/* Lire le total d'une vente */
function obtenirTotalVente(vente) {
    if (vente.total !== undefined && vente.total !== null) {
        return Number(vente.total) || 0;
    }

    if (vente.totalGeneral !== undefined) {
        return Number(vente.totalGeneral) || 0;
    }

    if (vente.montantTotal !== undefined) {
        return Number(vente.montantTotal) || 0;
    }

    if (Array.isArray(vente.lignes)) {
        return vente.lignes.reduce((total, ligne) => {
            const quantite = Number(ligne.quantite) || 0;
            const prix = Number(
                ligne.prixVente ?? ligne.prixUnitaire ?? ligne.prix
            ) || 0;

            return total + quantite * prix;
        }, 0);
    }

    return 0;
}

/* Afficher l'historique des encaissements */
async function afficherHistoriqueCaisse() {
    const zone = document.getElementById("historiqueCaisse");

    if (!zone) {
        console.error(
            "Élément historiqueCaisse introuvable dans index.html."
        );
        return;
    }

    zone.innerHTML = "<p>Chargement de l'historique...</p>";

    try {
        const ventes = await lireTous("ventes");

        ventes.sort((a, b) => {
            const dateA = new Date(a.date || a.dateCreation || 0).getTime();
            const dateB = new Date(b.date || b.dateCreation || 0).getTime();

            return dateB - dateA;
        });

        if (ventes.length === 0) {
            zone.innerHTML = `
                <div class="message-info">
                    <h3>Historique de caisse</h3>
                    <p>Aucun encaissement enregistré.</p>
                </div>
            `;
            return;
        }

        const totalGeneral = ventes.reduce(
            (somme, vente) => somme + obtenirTotalVente(vente),
            0
        );

        zone.innerHTML = `
            <div class="resume-caisse">
                <div class="carte-statistique">
                    <h3>Nombre de ventes</h3>
                    <p>${ventes.length}</p>
                </div>

                <div class="carte-statistique">
                    <h3>Total des ventes</h3>
                    <p>${formaterFCCaisse(totalGeneral)}</p>
                </div>
            </div>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>N° de vente</th>
                            <th>Date</th>
                            <th>Articles</th>
                            <th>Total</th>
                            <th>Montant payé</th>
                            <th>Monnaie rendue</th>
                            <th>Paiement</th>
                        </tr>
                    </thead>

                    <tbody>
                        ${ventes.map(vente => {
                            const total = obtenirTotalVente(vente);
                            const montantPaye = Number(
                                vente.montantPaye ?? vente.montantVerse
                            );

                            const monnaie = Number(
                                vente.monnaie ?? vente.monnaieRendue
                            );

                            const lignes = Array.isArray(vente.lignes)
                                ? vente.lignes
                                : [];

                            const nombreArticles = lignes.reduce(
                                (somme, ligne) =>
                                    somme + (Number(ligne.quantite) || 0),
                                0
                            );

                            return `
                                <tr>
                                    <td>${securiserCaisse(
                                        vente.numero || vente.id || "-"
                                    )}</td>

                                    <td>${securiserCaisse(
                                        formaterDateCaisse(
                                            vente.date || vente.dateCreation
                                        )
                                    )}</td>

                                    <td>${nombreArticles}</td>

                                    <td>${formaterFCCaisse(total)}</td>

                                    <td>${formaterFCCaisse(
                                        Number.isFinite(montantPaye)
                                            ? montantPaye
                                            : total
                                    )}</td>

                                    <td>${formaterFCCaisse(
                                        Number.isFinite(monnaie)
                                            ? monnaie
                                            : 0
                                    )}</td>

                                    <td>${securiserCaisse(
                                        vente.modePaiement || "Espèces"
                                    )}</td>
                                </tr>
                            `;
                        }).join("")}
                    </tbody>
                </table>
            </div>
        `;

        console.log(
            "Historique de caisse affiché :",
            ventes.length,
            "vente(s)."
        );

    } catch (erreur) {
        console.error("Erreur d'affichage de la caisse :", erreur);

        zone.innerHTML = `
            <div class="message-erreur">
                <h3>Impossible de charger la caisse</h3>
                <p>${securiserCaisse(
                    erreur.message || "Erreur inconnue"
                )}</p>
            </div>
        `;
    }
}

/* Calculer le résumé financier du jour */
async function calculerResumeCaisse() {
    const ventes = await lireTous("ventes");

    const aujourdHui = new Date().toLocaleDateString("fr-CA");

    const ventesDuJour = ventes.filter(vente => {
        const date = vente.date || vente.dateCreation;

        if (!date) return false;

        return new Date(date).toLocaleDateString("fr-CA") === aujourdHui;
    });

    const montantTotal = ventesDuJour.reduce(
        (somme, vente) => somme + obtenirTotalVente(vente),
        0
    );

    const especes = ventesDuJour
        .filter(vente => (vente.modePaiement || "Espèces") === "Espèces")
        .reduce(
            (somme, vente) => somme + obtenirTotalVente(vente),
            0
        );

    return {
        nombreVentes: ventesDuJour.length,
        montantTotal,
        especes,
        autresPaiements: montantTotal - especes
    };
}

/* Afficher le résumé financier */
async function afficherResumeCaisse() {
    const resume = await calculerResumeCaisse();

    return `
        <div class="cartes-statistiques">
            <div class="carte-statistique">
                <h3>Ventes du jour</h3>
                <p>${resume.nombreVentes}</p>
            </div>

            <div class="carte-statistique">
                <h3>Recettes du jour</h3>
                <p>${formaterFCCaisse(resume.montantTotal)}</p>
            </div>

            <div class="carte-statistique">
                <h3>Espèces</h3>
                <p>${formaterFCCaisse(resume.especes)}</p>
            </div>

            <div class="carte-statistique">
                <h3>Autres paiements</h3>
                <p>${formaterFCCaisse(resume.autresPaiements)}</p>
            </div>
        </div>
    `;
}

/* Actualiser la caisse */
async function actualiserCaisse() {
    await afficherHistoriqueCaisse();
}

/* Initialiser le module */
function initialiserModuleCaisse() {
    afficherHistoriqueCaisse().catch(erreur => {
        console.error("Initialisation de la caisse impossible :", erreur);
    });
}

if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserModuleCaisse
    );
} else {
    initialiserModuleCaisse();
}