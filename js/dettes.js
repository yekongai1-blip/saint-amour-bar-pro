"use strict";

/* ==========================================
   SAINT-AMOUR BAR PRO
   GESTION DES DETTES CLIENTS
   ========================================== */

function securiserDette(texte) {
    const caracteres = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    return String(texte ?? "").replace(
        /[&<>"']/g,
        caractere => caracteres[caractere]
    );
}

function formaterMontantDette(montant) {
    return new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 0
    }).format(Number(montant) || 0) + " FCFA";
}

function formaterDateDette(date) {
    if (!date) return "-";

    const valeur = new Date(date);

    if (Number.isNaN(valeur.getTime())) {
        return "-";
    }

    return valeur.toLocaleString("fr-FR");
}

/* Lire les dettes */
async function obtenirDettes() {
    const resultat = await lireTous("dettes");
    return Array.isArray(resultat) ? resultat : [];
}

/* Calculer les montants */
function calculerDette(dette) {
    const initial = Number(
        dette.montantInitial ?? dette.montant ?? 0
    );

    const rembourse = Number(
        dette.montantRembourse ?? dette.remboursement ?? 0
    );

    const restant = Math.max(0, initial - rembourse);

    return {
        initial,
        rembourse,
        restant
    };
}

/* Afficher la liste des dettes */
async function afficherDettes() {
    const zone = document.getElementById("listeDettes");

    if (!zone) {
        console.error("Élément listeDettes introuvable.");
        return;
    }

    try {
        const dettes = await obtenirDettes();

        dettes.sort((a, b) =>
            new Date(b.date || b.dateCreation || 0) -
            new Date(a.date || a.dateCreation || 0)
        );

        let totalInitial = 0;
        let totalRembourse = 0;
        let totalRestant = 0;
        let dettesOuvertes = 0;

        dettes.forEach(dette => {
            const montants = calculerDette(dette);

            totalInitial += montants.initial;
            totalRembourse += montants.rembourse;
            totalRestant += montants.restant;

            if (montants.restant > 0) {
                dettesOuvertes++;
            }
        });

        zone.innerHTML = `
            <div class="statistiques">
                <article class="carte">
                    <h3>Nombre de dettes</h3>
                    <p>${dettes.length}</p>
                </article>

                <article class="carte">
                    <h3>Dettes en cours</h3>
                    <p>${dettesOuvertes}</p>
                </article>

                <article class="carte">
                    <h3>Total initial</h3>
                    <p>${formaterMontantDette(totalInitial)}</p>
                </article>

                <article class="carte">
                    <h3>Total remboursé</h3>
                    <p>${formaterMontantDette(totalRembourse)}</p>
                </article>

                <article class="carte">
                    <h3>Reste à récupérer</h3>
                    <p>${formaterMontantDette(totalRestant)}</p>
                </article>
            </div>

            <h3>Historique des dettes clients</h3>

            ${
                dettes.length === 0
                    ? "<p>Aucune dette enregistrée.</p>"
                    : `
                        <div class="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Client</th>
                                        <th>Téléphone</th>
                                        <th>Motif</th>
                                        <th>Dette initiale</th>
                                        <th>Remboursé</th>
                                        <th>Reste</th>
                                        <th>État</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    ${dettes.map(dette => {
                                        const montants =
                                            calculerDette(dette);

                                        return `
                                            <tr>
                                                <td>
                                                    ${securiserDette(
                                                        formaterDateDette(
                                                            dette.date ||
                                                            dette.dateCreation
                                                        )
                                                    )}
                                                </td>

                                                <td>
                                                    ${securiserDette(
                                                        dette.client ||
                                                        dette.nomClient ||
                                                        ""
                                                    )}
                                                </td>

                                                <td>
                                                    ${securiserDette(
                                                        dette.telephone || ""
                                                    )}
                                                </td>

                                                <td>
                                                    ${securiserDette(
                                                        dette.motif ||
                                                        dette.libelle ||
                                                        ""
                                                    )}
                                                </td>

                                                <td>
                                                    ${formaterMontantDette(
                                                        montants.initial
                                                    )}
                                                </td>

                                                <td>
                                                    ${formaterMontantDette(
                                                        montants.rembourse
                                                    )}
                                                </td>

                                                <td>
                                                    <strong>
                                                        ${formaterMontantDette(
                                                            montants.restant
                                                        )}
                                                    </strong>
                                                </td>

                                                <td>
                                                    ${
                                                        montants.restant <= 0
                                                            ? "Soldée"
                                                            : montants.rembourse > 0
                                                                ? "Partiellement payée"
                                                                : "En cours"
                                                    }
                                                </td>

                                                <td>
                                                    ${
                                                        montants.restant > 0
                                                            ? `
                                                                <button
                                                                    type="button"
                                                                    data-action-dette="rembourser"
                                                                    data-id-dette="${securiserDette(dette.id)}">
                                                                    💰 Rembourser
                                                                </button>
                                                            `
                                                            : "<span>Dette réglée</span>"
                                                    }

                                                    <button
                                                        type="button"
                                                        data-action-dette="supprimer"
                                                        data-id-dette="${securiserDette(dette.id)}">
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
    } catch (erreur) {
        console.error("Erreur d'affichage des dettes :", erreur);

        zone.innerHTML = `
            <p>Impossible de charger les dettes.</p>
            <p>${securiserDette(
                erreur.message || "Erreur inconnue"
            )}</p>
        `;
    }
}

/* Enregistrer une dette */
/* Enregistrer une dette — version corrigée */
async function enregistrerDette(evenement) {
    evenement.preventDefault();

    const formulaire = document.getElementById("formDette");
    const client = document.getElementById("nomClientDette");
    const telephone = document.getElementById("telephoneClientDette");
    const motif = document.getElementById("descriptionDette");
    const montant = document.getElementById("montantDette");

    if (!formulaire || !client || !motif || !montant) {
        alert(
            "Formulaire de dette incomplet : vérifiez les identifiants HTML."
        );
        console.error("Éléments du formulaire de dette :", {
            formulaire: !!formulaire,
            client: !!client,
            telephone: !!telephone,
            motif: !!motif,
            montant: !!montant
        });
        return;
    }

    const nomClient = client.value.trim();
    const motifDette = motif.value.trim();
    const montantDette = Number(montant.value);

    if (!nomClient || !motifDette) {
        alert("Veuillez renseigner le nom du client et la description.");
        return;
    }

    if (!Number.isFinite(montantDette) || montantDette <= 0) {
        alert("Le montant de la dette doit être supérieur à zéro.");
        return;
    }

    const maintenant = new Date().toISOString();

    const dette = {
        client: nomClient,
        nomClient: nomClient,
        telephone: telephone ? telephone.value.trim() : "",
        motif: motifDette,
        libelle: motifDette,
        montant: montantDette,
        montantInitial: montantDette,
        montantRembourse: 0,
        date: maintenant,
        dateCreation: maintenant
    };

    try {
        await ajouterEnregistrement("dettes", dette);

        formulaire.reset();

        await afficherDettes();

        if (typeof actualiserStatistiques === "function") {
            await actualiserStatistiques();
        }

        alert("Dette enregistrée avec succès !");
    } catch (erreur) {
        console.error("Erreur d'enregistrement de la dette :", erreur);

        alert(
            "Impossible d'enregistrer la dette : " +
            (erreur.message || String(erreur))
        );
    }
}

/* Remboursement partiel ou total */
async function rembourserDette(id) {
    try {
        const dettes = await obtenirDettes();

        const dette = dettes.find(element =>
            String(element.id) === String(id)
        );

        if (!dette) {
            alert("Dette introuvable.");
            return;
        }

        const montants = calculerDette(dette);

        if (montants.restant <= 0) {
            alert("Cette dette est déjà soldée.");
            await afficherDettes();
            return;
        }

        const saisie = prompt(
            "Montant du remboursement en FCFA.\n" +
            "Reste à payer : " +
            formaterMontantDette(montants.restant)
        );

        if (saisie === null) return;

        const montantPaye = Number(saisie);

        if (
            !Number.isFinite(montantPaye) ||
            montantPaye <= 0 ||
            montantPaye > montants.restant
        ) {
            alert(
                "Saisissez un montant positif inférieur ou égal au reste à payer."
            );
            return;
        }

        const detteModifiee = {
            ...dette,
            montantInitial: montants.initial,
            montant: montants.initial,
            montantRembourse:
                montants.rembourse + montantPaye,
            dateDernierRemboursement:
                new Date().toISOString()
        };

        await modifierEnregistrement(
            "dettes",
            detteModifiee
        );

        await afficherDettes();

        if (typeof actualiserStatistiques === "function") {
            await actualiserStatistiques();
        }

        alert(
            "Remboursement enregistré !\n" +
            "Montant payé : " +
            formaterMontantDette(montantPaye) +
            "\nReste à payer : " +
            formaterMontantDette(
                montants.restant - montantPaye
            )
        );
    } catch (erreur) {
        console.error("Erreur de remboursement :", erreur);

        alert(
            "Impossible d'enregistrer le remboursement : " +
            (erreur.message || String(erreur))
        );
    }
}

/* Supprimer une dette */
async function supprimerDette(id) {
    if (!confirm("Voulez-vous vraiment supprimer cette dette ?")) {
        return;
    }

    try {
        await supprimerEnregistrement("dettes", Number(id));

        await afficherDettes();

        if (typeof actualiserStatistiques === "function") {
            await actualiserStatistiques();
        }

        alert("Dette supprimée.");
    } catch (erreur) {
        console.error("Erreur de suppression :", erreur);

        alert(
            "Impossible de supprimer la dette : " +
            (erreur.message || String(erreur))
        );
    }
}

/* Initialiser les événements */
function initialiserDettes() {
    const formulaire = document.getElementById("formDette");
    const zone = document.getElementById("listeDettes");

    if (formulaire && formulaire.dataset.initialise !== "oui") {
        formulaire.addEventListener("submit", enregistrerDette);
        formulaire.dataset.initialise = "oui";
    }

    if (zone && zone.dataset.initialise !== "oui") {
        zone.addEventListener("click", async evenement => {
            const element = evenement.target;

            if (!(element instanceof Element)) return;

            const bouton = element.closest(
                "button[data-action-dette]"
            );

            if (!bouton) return;

            const action = bouton.dataset.actionDette;
            const id = bouton.dataset.idDette;

            if (action === "rembourser") {
                await rembourserDette(id);
            } else if (action === "supprimer") {
                await supprimerDette(id);
            }
        });

        zone.dataset.initialise = "oui";
    }

    afficherDettes().catch(console.error);
}

/* Démarrage */
if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserDettes,
        { once: true }
    );
} else {
    initialiserDettes();
}
