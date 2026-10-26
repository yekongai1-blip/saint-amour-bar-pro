"use strict";

/* ==========================================
   SAINT-AMOUR BAR PRO
   GESTION DES DEPENSES
   ========================================== */

/* 1. Sécuriser les textes */
function securiserDepense(texte) {
    const caracteres = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    };

    return String(texte ?? "").replace(
        /[&<>"']/g,
        function (caractere) {
            return caracteres[caractere];
        }
    );
}

/* 2. Formater les montants */
function formaterMontantDepense(montant) {
    return new Intl.NumberFormat("fr-FR", {
        maximumFractionDigits: 0
    }).format(Number(montant) || 0) + " FCFA";
}

/* 3. Formater les dates */
function formaterDateDepense(date) {
    if (!date) return "-";

    const valeur = new Date(date);

    if (Number.isNaN(valeur.getTime())) {
        return "-";
    }

    return valeur.toLocaleString("fr-FR");
}

/* 4. Lire les dépenses */
async function obtenirDepenses() {
    return await lireTous("depenses");
}

/* 5. Actualiser les statistiques générales */
async function actualiserApresDepense() {
    if (typeof actualiserStatistiques === "function") {
        await actualiserStatistiques();
    }
}

/* 6. Afficher les dépenses */
async function afficherDepenses() {
    const zone = document.getElementById("listeDepenses");

    if (!zone) {
        console.error(
            "Élément listeDepenses introuvable dans index.html."
        );
        return;
    }

    try {
        const resultat = await obtenirDepenses();
        const depenses = Array.isArray(resultat) ? resultat : [];

        depenses.sort(function (a, b) {
            return new Date(
                b.date || b.dateCreation || 0
            ) - new Date(
                a.date || a.dateCreation || 0
            );
        });

        const total = depenses.reduce(function (somme, depense) {
            return somme + (Number(depense.montant) || 0);
        }, 0);

        const maintenant = new Date();

        const depensesDuJour = depenses.filter(function (depense) {
            const date = new Date(
                depense.date || depense.dateCreation || 0
            );

            return !Number.isNaN(date.getTime()) &&
                date.getFullYear() === maintenant.getFullYear() &&
                date.getMonth() === maintenant.getMonth() &&
                date.getDate() === maintenant.getDate();
        });

        const totalJour = depensesDuJour.reduce(
            function (somme, depense) {
                return somme + (Number(depense.montant) || 0);
            },
            0
        );

        zone.innerHTML = `
            <div class="statistiques">
                <article class="carte">
                    <h3>Nombre de dépenses</h3>
                    <p>${depenses.length}</p>
                </article>

                <article class="carte">
                    <h3>Dépenses du jour</h3>
                    <p>${formaterMontantDepense(totalJour)}</p>
                </article>

                <article class="carte">
                    <h3>Total des dépenses</h3>
                    <p>${formaterMontantDepense(total)}</p>
                </article>
            </div>

            <h3>Historique des dépenses</h3>

            ${
                depenses.length === 0
                    ? "<p>Aucune dépense enregistrée.</p>"
                    : `
                        <div class="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Motif</th>
                                        <th>Montant</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>

                                <tbody>
                                    ${depenses.map(function (depense) {
                                        return `
                                            <tr>
                                                <td>${securiserDepense(
                                                    formaterDateDepense(
                                                        depense.date ||
                                                        depense.dateCreation
                                                    )
                                                )}</td>

                                                <td>${securiserDepense(
                                                    depense.libelle ||
                                                    depense.motif ||
                                                    "Sans motif"
                                                )}</td>

                                                <td>${formaterMontantDepense(
                                                    depense.montant
                                                )}</td>

                                                <td>
                                                    <button
                                                        type="button"
                                                        data-action-depense="modifier"
                                                        data-id-depense="${securiserDepense(depense.id)}">
                                                        Modifier
                                                    </button>

                                                    <button
                                                        type="button"
                                                        data-action-depense="supprimer"
                                                        data-id-depense="${securiserDepense(depense.id)}">
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
        console.error(
            "Erreur d'affichage des dépenses :",
            erreur
        );

        zone.innerHTML = `
            <p>Erreur lors du chargement des dépenses.</p>
            <p>${securiserDepense(
                erreur.message || "Erreur inconnue"
            )}</p>
        `;
    }
}

/* 7. Enregistrer une dépense */
async function enregistrerDepense(evenement) {
    evenement.preventDefault();

    const formulaire = document.getElementById("formDepense");
    const champLibelle = document.getElementById("libelleDepense");
    const champMontant = document.getElementById("montantDepense");

    if (!formulaire || !champLibelle || !champMontant) {
        alert("Erreur : formulaire des dépenses introuvable.");
        return;
    }

    const libelle = champLibelle.value.trim();
    const montant = Number(champMontant.value);

    if (!libelle) {
        alert("Veuillez saisir le motif de la dépense.");
        champLibelle.focus();
        return;
    }

    if (!Number.isFinite(montant) || montant <= 0) {
        alert("Veuillez saisir un montant supérieur à zéro.");
        champMontant.focus();
        return;
    }

    const maintenant = new Date().toISOString();

    const depense = {
        libelle: libelle,
        montant: montant,
        date: maintenant,
        dateCreation: maintenant
    };

    try {
        await ajouterEnregistrement("depenses", depense);

        formulaire.reset();

        await afficherDepenses();
        await actualiserApresDepense();

        alert("Dépense enregistrée avec succès !");
    } catch (erreur) {
        console.error(
            "Erreur d'enregistrement de la dépense :",
            erreur
        );

        alert(
            "Impossible d'enregistrer la dépense : " +
            (erreur.message || String(erreur))
        );
    }
}

/* 8. Modifier une dépense */
async function modifierDepense(id) {
    try {
        const depenses = await obtenirDepenses();

        const depense = depenses.find(function (element) {
            return String(element.id) === String(id);
        });

        if (!depense) {
            alert("Dépense introuvable.");
            return;
        }

        const libelle = prompt(
            "Nouveau motif :",
            depense.libelle || depense.motif || ""
        );

        if (libelle === null) return;

        if (!libelle.trim()) {
            alert("Le motif ne peut pas être vide.");
            return;
        }

        const saisieMontant = prompt(
            "Nouveau montant en FCFA :",
            String(depense.montant)
        );

        if (saisieMontant === null) return;

        const montant = Number(saisieMontant);

        if (!Number.isFinite(montant) || montant <= 0) {
            alert("Le montant doit être supérieur à zéro.");
            return;
        }

        const depenseModifiee = {
            ...depense,
            libelle: libelle.trim(),
            montant: montant,
            dateModification: new Date().toISOString()
        };

        await modifierEnregistrement(
            "depenses",
            depenseModifiee
        );

        await afficherDepenses();
        await actualiserApresDepense();

        alert("Dépense modifiée avec succès !");
    } catch (erreur) {
        console.error(
            "Erreur de modification de la dépense :",
            erreur
        );

        alert(
            "Impossible de modifier la dépense : " +
            (erreur.message || String(erreur))
        );
    }
}

/* 9. Supprimer une dépense */
async function supprimerDepense(id) {
    if (!confirm(
        "Voulez-vous vraiment supprimer cette dépense ?"
    )) {
        return;
    }

    try {
        await supprimerEnregistrement(
            "depenses",
            Number(id)
        );

        await afficherDepenses();
        await actualiserApresDepense();

        alert("Dépense supprimée avec succès !");
    } catch (erreur) {
        console.error(
            "Erreur de suppression de la dépense :",
            erreur
        );

        alert(
            "Impossible de supprimer la dépense : " +
            (erreur.message || String(erreur))
        );
    }
}

/* 10. Initialiser le formulaire et les boutons */
function initialiserDepenses() {
    const formulaire = document.getElementById("formDepense");
    const zone = document.getElementById("listeDepenses");

    if (
        formulaire &&
        formulaire.dataset.initialise !== "oui"
    ) {
        formulaire.addEventListener(
            "submit",
            enregistrerDepense
        );

        formulaire.dataset.initialise = "oui";
    }

    if (
        zone &&
        zone.dataset.initialise !== "oui"
    ) {
        zone.addEventListener("click", async function (evenement) {
            const element = evenement.target;

            if (!(element instanceof Element)) return;

            const bouton = element.closest(
                "button[data-action-depense]"
            );

            if (!bouton) return;

            const action = bouton.dataset.actionDepense;
            const id = bouton.dataset.idDepense;

            if (action === "modifier") {
                await modifierDepense(id);
            } else if (action === "supprimer") {
                await supprimerDepense(id);
            }
        });

        zone.dataset.initialise = "oui";
    }

    afficherDepenses().catch(function (erreur) {
        console.error(
            "Erreur d'initialisation des dépenses :",
            erreur
        );
    });
}

/* 11. Démarrer le module */
if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserDepenses,
        { once: true }
    );
} else {
    initialiserDepenses();
}
window.afficherDepenses = afficherDepenses;
