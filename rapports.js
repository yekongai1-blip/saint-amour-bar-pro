"use strict";

/* ==========================================
   CHATGPT BAR PRO
   MODULE RAPPORTS COMMERCIAUX
   ========================================== */

function elementRapport(id) {
    return document.getElementById(id);
}

function formaterMontantRapport(montant) {
    return (Number(montant) || 0).toLocaleString("fr-FR") + " FCFA";
}

function dateRapport(date) {
    if (!date) return "";

    const d = new Date(date);

    if (Number.isNaN(d.getTime())) return "";

    return [
        d.getFullYear(),
        String(d.getMonth() + 1).padStart(2, "0"),
        String(d.getDate()).padStart(2, "0")
    ].join("-");
}

function echapperRapport(texte) {
    return String(texte ?? "").replace(/[&<>"']/g, caractere => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[caractere]);
}

async function lireToutRapport(nomMagasin) {
    if (typeof lireTousLesEnregistrements === "function") {
        return await lireTousLesEnregistrements(nomMagasin);
    }

    if (typeof lireTous === "function") {
        return await lireTous(nomMagasin);
    }

    if (typeof obtenirTous === "function") {
        return await obtenirTous(nomMagasin);
    }

    return new Promise((resolve, reject) => {
        const demande = indexedDB.open("ChatGPTBarProDB");

        demande.onerror = () => reject(demande.error);

        demande.onsuccess = () => {
            const db = demande.result;

            if (!db.objectStoreNames.contains(nomMagasin)) {
                db.close();
                resolve([]);
                return;
            }

            const transaction = db.transaction(nomMagasin, "readonly");
            const requete = transaction.objectStore(nomMagasin).getAll();

            requete.onsuccess = () => resolve(requete.result || []);
            requete.onerror = () => reject(requete.error);

            transaction.oncomplete = () => db.close();
            transaction.onerror = () => {
                db.close();
                reject(transaction.error);
            };
        };
    });
}

function montantVenteRapport(vente) {
    const champs = [
        "total",
        "montantTotal",
        "montant",
        "totalVente",
        "totalTTC"
    ];

    for (const champ of champs) {
        if (
            vente[champ] !== undefined &&
            vente[champ] !== null &&
            vente[champ] !== ""
        ) {
            const valeur = Number(vente[champ]);
            if (Number.isFinite(valeur)) return valeur;
        }
    }

    const lignes = obtenirLignesVenteRapport(vente);

    return lignes.reduce((total, ligne) => {
        const quantite = Number(ligne.quantite) || 0;
        const prix = Number(
            ligne.prixUnitaire ??
            ligne.prixVente ??
            ligne.prix ??
            0
        );

        return total + quantite * prix;
    }, 0);
}

function dateVenteRapport(vente) {
    return vente.date ||
        vente.dateVente ||
        vente.dateCreation ||
        vente.createdAt ||
        "";
}

function montantDepenseRapport(depense) {
    return Number(
        depense.montant ??
        depense.montantDepense ??
        depense.total ??
        0
    ) || 0;
}

function dateDepenseRapport(depense) {
    return depense.date ||
        depense.dateDepense ||
        depense.dateCreation ||
        depense.createdAt ||
        "";
}

function obtenirLignesVenteRapport(vente) {
    if (Array.isArray(vente.lignes)) return vente.lignes;
    if (Array.isArray(vente.produits)) return vente.produits;
    if (Array.isArray(vente.articles)) return vente.articles;
    return [];
}

function coutAchatLigneRapport(ligne) {
    const quantite = Number(ligne.quantite) || 0;

    const prixAchat = Number(
        ligne.prixAchatUnitaire ??
        ligne.prixAchat ??
        ligne.coutUnitaire
    );

    if (!Number.isFinite(prixAchat)) return null;

    return quantite * prixAchat;
}

function beneficeBrutVenteRapport(vente) {
    const lignes = obtenirLignesVenteRapport(vente);

    if (lignes.length === 0) return null;

    const couts = lignes.map(coutAchatLigneRapport);

    if (couts.some(cout => cout === null)) return null;

    const coutTotal = couts.reduce((total, cout) => total + cout, 0);

    return montantVenteRapport(vente) - coutTotal;
}

/* ==========================================
   AFFICHAGE DE LA PAGE RAPPORTS
   ========================================== */

async function afficherRapports() {
    const zone =
        document.getElementById("page-rapports") ||
        document.getElementById("contenuPrincipal");

    if (!zone) {
        console.error("Zone de rapports introuvable.");
        return;
    }

    zone.innerHTML = `
        <section class="page">
            <div class="enteteRapport">
                <h1>SAINT-AMOUR BAR</h1>
                <p><strong>Adresse :</strong> GALABADJA 6</p>
                <p><strong>Téléphone :</strong> 72 48 17 48</p>
                <h2>RAPPORT COMMERCIAL</h2>
                <p>Ventes, dépenses, bénéfices et classement des produits</p>
            </div>

            <form id="formFiltresRapports">
                <label for="rapportDateDebut">Date de début</label>
                <input type="date" id="rapportDateDebut" required>

                <label for="rapportDateFin">Date de fin</label>
                <input type="date" id="rapportDateFin" required>

                <button type="submit">Afficher le rapport</button>

                <button type="button" id="rapportAujourdHui">
                    Aujourd'hui
                </button>

                <button type="button" id="rapportCeMois">
                    Ce mois
                </button>
            </form>

            <div id="resultatRapports" aria-live="polite">
                Chargement des rapports...
            </div>

            <div id="classementProduits"></div>
        </section>
    `;

    const debut = elementRapport("rapportDateDebut");
    const fin = elementRapport("rapportDateFin");

    const maintenant = new Date();
    const aujourdHui = dateRapport(maintenant);

    debut.value = aujourdHui;
    fin.value = aujourdHui;

    elementRapport("formFiltresRapports").addEventListener(
        "submit",
        async evenement => {
            evenement.preventDefault();
            await calculerRapports(debut.value, fin.value);
        }
    );

    elementRapport("rapportAujourdHui").addEventListener(
        "click",
        async () => {
            const date = dateRapport(new Date());
            debut.value = date;
            fin.value = date;
            await calculerRapports(debut.value, fin.value);
        }
    );

    elementRapport("rapportCeMois").addEventListener(
        "click",
        async () => {
            const date = new Date();

            debut.value = [
                date.getFullYear(),
                String(date.getMonth() + 1).padStart(2, "0"),
                "01"
            ].join("-");

            fin.value = dateRapport(date);

            await calculerRapports(debut.value, fin.value);
        }
    );

    await calculerRapports(debut.value, fin.value);
}

/* ==========================================
   CALCUL DES RAPPORTS
   ========================================== */

async function calculerRapports(dateDebut, dateFin) {
    const resultat = elementRapport("resultatRapports");

    if (!resultat) return;

    if (!dateDebut || !dateFin || dateDebut > dateFin) {
        resultat.innerHTML =
            "<p role='alert'>Veuillez choisir une période valide.</p>";
        return;
    }

    resultat.innerHTML = "<p>Calcul des rapports...</p>";

    try {
        const [ventesToutes, depensesToutes] = await Promise.all([
            lireToutRapport("ventes"),
            lireToutRapport("depenses")
        ]);

        const ventes = ventesToutes.filter(vente => {
            const date = dateRapport(dateVenteRapport(vente));
            const statut = String(vente.statut || "").toLowerCase();

            const annulee = [
                "annulée",
                "annulee",
                "annulé",
                "annule",
                "supprimée",
                "supprimee"
            ].includes(statut);

            return date &&
                date >= dateDebut &&
                date <= dateFin &&
                !annulee;
        });

        const depenses = depensesToutes.filter(depense => {
            const date = dateRapport(dateDepenseRapport(depense));

            return date &&
                date >= dateDebut &&
                date <= dateFin;
        });

        const chiffreAffaires = ventes.reduce(
            (total, vente) => total + montantVenteRapport(vente),
            0
        );

        const totalDepenses = depenses.reduce(
            (total, depense) => total + montantDepenseRapport(depense),
            0
        );

        const beneficesBruts = ventes.map(beneficeBrutVenteRapport);

        const coutsDisponibles =
            ventes.length > 0 &&
            beneficesBruts.every(montant => montant !== null);

        const beneficeBrutConnu = beneficesBruts
            .filter(montant => montant !== null)
            .reduce((total, montant) => total + montant, 0);

        const beneficeNet = coutsDisponibles
            ? beneficeBrutConnu - totalDepenses
            : null;

        const produitsVendus = ventes.reduce((total, vente) => {
            return total + obtenirLignesVenteRapport(vente).reduce(
                (somme, ligne) =>
                    somme + (Number(ligne.quantite) || 0),
                0
            );
        }, 0);

        resultat.innerHTML = `
            <div class="statistiques">
                <div class="carte">
                    <h3>Chiffre d'affaires</h3>
                    <p>${formaterMontantRapport(chiffreAffaires)}</p>
                </div>

                <div class="carte">
                    <h3>Nombre de ventes</h3>
                    <p>${ventes.length}</p>
                </div>

                <div class="carte">
                    <h3>Articles vendus</h3>
                    <p>${produitsVendus}</p>
                </div>

                <div class="carte">
                    <h3>Dépenses</h3>
                    <p>${formaterMontantRapport(totalDepenses)}</p>
                </div>

                <div class="carte">
                    <h3>Bénéfice brut</h3>
                    <p>${
                        coutsDisponibles
                            ? formaterMontantRapport(beneficeBrutConnu)
                            : "Coûts d'achat indisponibles"
                    }</p>
                </div>

                <div class="carte">
                    <h3>Bénéfice net estimé</h3>
                    <p>${
                        beneficeNet === null
                            ? "Non calculable"
                            : formaterMontantRapport(beneficeNet)
                    }</p>
                </div>
            </div>

            ${
                !coutsDisponibles
                    ? `<p class="alerte-stock">
                        Le bénéfice est estimé uniquement si les prix d'achat
                        sont enregistrés pour toutes les lignes de vente.
                    </p>`
                    : ""
            }

            <h3>Détail des ventes</h3>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Référence</th>
                            <th>Montant</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            ventes.length
                                ? ventes.map(vente => `
                                    <tr>
                                        <td>${echapperRapport(
                                            dateRapport(dateVenteRapport(vente))
                                        )}</td>
                                        <td>${echapperRapport(
                                            vente.reference ||
                                            vente.numero ||
                                            vente.id ||
                                            "-"
                                        )}</td>
                                        <td>${formaterMontantRapport(
                                            montantVenteRapport(vente)
                                        )}</td>
                                    </tr>
                                `).join("")
                                : `<tr><td colspan="3">
                                    Aucune vente pour cette période.
                                </td></tr>`
                        }
                    </tbody>
                </table>
            </div>

            <h3>Détail des dépenses</h3>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Motif</th>
                            <th>Montant</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            depenses.length
                                ? depenses.map(depense => `
                                    <tr>
                                        <td>${echapperRapport(
                                            dateRapport(dateDepenseRapport(depense))
                                        )}</td>
                                        <td>${echapperRapport(
                                            depense.description ||
                                            depense.motif ||
                                            depense.libelle ||
                                            "-"
                                        )}</td>
                                        <td>${formaterMontantRapport(
                                            montantDepenseRapport(depense)
                                        )}</td>
                                    </tr>
                                `).join("")
                                : `<tr><td colspan="3">
                                    Aucune dépense pour cette période.
                                </td></tr>`
                        }
                    </tbody>
                </table>
            </div>

            <div class="piedRapport">
                <p>
                    <strong>Période du rapport :</strong>
                    ${echapperRapport(dateDebut)} au ${echapperRapport(dateFin)}
                </p>

                <p>
                    <strong>Date d'impression :</strong>
                    <span id="dateImpressionRapport"></span>
                </p>

                <div class="signaturesRapport">
                    <div>
                        <strong>Le responsable</strong>
                        <p>Nom et signature :</p>
                        <br><br>
                        __________________________
                    </div>

                    <div>
                        <strong>La direction</strong>
                        <p>Nom et signature :</p>
                        <br><br>
                        __________________________
                    </div>
                </div>
            </div>

            <button type="button" id="imprimerRapport">
                Imprimer le rapport
            </button>
        `;

        await afficherClassementProduits(dateDebut, dateFin);

        const dateImpression = elementRapport("dateImpressionRapport");

        if (dateImpression) {
            dateImpression.textContent =
                new Date().toLocaleString("fr-FR");
        }

        const boutonImpression = elementRapport("imprimerRapport");

        if (boutonImpression) {
            boutonImpression.onclick = function () {
                window.print();
            };
        }

    } catch (erreur) {
        console.error("Erreur rapports :", erreur);

        resultat.innerHTML = `
            <p role="alert">
                Impossible de charger les rapports.
                Vérifie la connexion à la base de données.
            </p>
        `;
    }
}

/* ==========================================
   CLASSEMENT DES PRODUITS
   ========================================== */

async function afficherClassementProduits(dateDebut, dateFin) {
    const zone = elementRapport("classementProduits");

    if (!zone) return;

    try {
        const [ventes, produits] = await Promise.all([
            lireToutRapport("ventes"),
            lireToutRapport("produits")
        ]);

        const ventesPeriode = ventes.filter(vente => {
            const date = dateRapport(dateVenteRapport(vente));
            const statut = String(vente.statut || "").toLowerCase();

            const annulee = [
                "annulée",
                "annulee",
                "annulé",
                "annule",
                "supprimée",
                "supprimee"
            ].includes(statut);

            return date &&
                date >= dateDebut &&
                date <= dateFin &&
                !annulee;
        });

        const produitsParId = new Map(
            produits.map(produit => [String(produit.id), produit])
        );

        const classement = new Map();

        ventesPeriode.forEach(vente => {
            obtenirLignesVenteRapport(vente).forEach(ligne => {
                const id = String(
                    ligne.idProduit ??
                    ligne.produitId ??
                    ligne.id ??
                    ""
                );

                const produit = produitsParId.get(id);

                const nom = ligne.nom ||
                    ligne.nomProduit ||
                    (produit && produit.nom) ||
                    "Produit sans nom";

                const quantite = Number(ligne.quantite) || 0;

                const prixVente = Number(
                    ligne.prixUnitaire ??
                    ligne.prixVente ??
                    ligne.prix ??
                    0
                );

                const valeurAchat =
                    ligne.prixAchatUnitaire ??
                    ligne.prixAchat ??
                    ligne.coutUnitaire ??
                    (produit && produit.prixAchat);

                const coutDisponible =
                    valeurAchat !== undefined &&
                    valeurAchat !== null &&
                    valeurAchat !== "";

                const prixAchat = coutDisponible
                    ? Number(valeurAchat)
                    : 0;

                const cle = id + "|" + nom;

                if (!classement.has(cle)) {
                    classement.set(cle, {
                        nom,
                        quantite: 0,
                        chiffreAffaires: 0,
                        benefice: 0,
                        coutDisponible: true
                    });
                }

                const element = classement.get(cle);

                element.quantite += quantite;
                element.chiffreAffaires += prixVente * quantite;

                if (coutDisponible && Number.isFinite(prixAchat)) {
                    element.benefice +=
                        (prixVente - prixAchat) * quantite;
                } else {
                    element.coutDisponible = false;
                }
            });
        });

        const liste = Array.from(classement.values());

        const plusVendus = [...liste]
            .sort((a, b) => b.quantite - a.quantite)
            .slice(0, 10);

        const plusRentables = [...liste]
            .filter(produit => produit.coutDisponible)
            .sort((a, b) => b.benefice - a.benefice)
            .slice(0, 10);

        const fcfa = montant =>
            (Number(montant) || 0).toLocaleString("fr-FR") + " FCFA";

        zone.innerHTML = `
            <h3>Top 10 des produits les plus vendus</h3>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Rang</th>
                            <th>Produit</th>
                            <th>Quantité vendue</th>
                            <th>Chiffre d'affaires</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            plusVendus.length
                                ? plusVendus.map((produit, index) => `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td>${echapperRapport(produit.nom)}</td>
                                        <td>${produit.quantite}</td>
                                        <td>${fcfa(produit.chiffreAffaires)}</td>
                                    </tr>
                                `).join("")
                                : `<tr><td colspan="4">
                                    Aucune vente sur cette période.
                                </td></tr>`
                        }
                    </tbody>
                </table>
            </div>

            <h3>Top 10 des produits les plus rentables</h3>

            <div class="table-responsive">
                <table>
                    <thead>
                        <tr>
                            <th>Rang</th>
                            <th>Produit</th>
                            <th>Bénéfice brut estimé</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${
                            plusRentables.length
                                ? plusRentables.map((produit, index) => `
                                    <tr>
                                        <td>${index + 1}</td>
                                        <td>${echapperRapport(produit.nom)}</td>
                                        <td>${fcfa(produit.benefice)}</td>
                                    </tr>
                                `).join("")
                                : `<tr><td colspan="3">
                                    Prix d'achat indisponibles pour le classement.
                                </td></tr>`
                        }
                    </tbody>
                </table>
            </div>
        `;

    } catch (erreur) {
        console.error("Erreur classement produits :", erreur);
        zone.innerHTML = `
            <p role="alert">
                Impossible de calculer le classement des produits.
            </p>
        `;
    }
}

/* Rend les fonctions accessibles à app.js */
window.afficherRapports = afficherRapports;
window.calculerRapports = calculerRapports;
window.afficherClassementProduits = afficherClassementProduits;
