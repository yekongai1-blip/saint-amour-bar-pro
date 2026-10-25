"use strict";

/* ==========================================
   CHATGPT BAR PRO
   Sauvegarde et restauration des données
   Compatible avec IndexedDB et le mode hors ligne
   ========================================== */

const NOM_BASE_BAR_SAUVEGARDE = "ChatGPTBarProDB";
const CLE_HISTORIQUE_STOCK_BAR = "chatgptBarProHistoriqueStock";
const VERSION_FORMAT_BAR = 1;

/* Afficher un message */
function messageSauvegardeBar(message, erreur = false) {
    let zone = document.getElementById("messageSauvegardeBar");

    if (!zone) {
        zone = document.createElement("p");
        zone.id = "messageSauvegardeBar";

        const panneau = document.getElementById("panneauSauvegardeBar");

        if (panneau) {
            panneau.appendChild(zone);
        } else {
            document.body.appendChild(zone);
        }
    }

    zone.textContent = message;
    zone.style.color = erreur ? "#ff7777" : "#7ee2a8";
    zone.style.padding = "10px";
    zone.style.overflowWrap = "anywhere";
}

/* Ouvrir la base existante sans la recréer ni la vider */
/* Ouvrir uniquement la base existante */
function ouvrirBaseSauvegardeBar() {
return new Promise((resolve, reject) => {
if (!window.indexedDB) {
reject(new Error("IndexedDB n'est pas disponible."));
return;
}
    const demande = indexedDB.open(NOM_BASE_BAR_SAUVEGARDE);

    demande.onupgradeneeded = () => {
        /*
         * Si la base n'existait pas, empêcher la création
         * d'une base vide par la fonction de sauvegarde.
         */
        demande.transaction.abort();
    };

    demande.onsuccess = () => {
        const base = demande.result;

        if (base.objectStoreNames.length === 0) {
            base.close();
            reject(new Error(
                "La base existe, mais elle ne contient aucune table."
            ));
            return;
        }

        base.onversionchange = () => base.close();
        resolve(base);
    };

    demande.onerror = () => {
        reject(new Error(
            "Impossible d'ouvrir la base existante. " +
            "Ouvrez d'abord CHATGPT BAR PRO et vérifiez son initialisation."
        ));
    };
});

}

/* Lire un magasin IndexedDB avec ses clés */
function lireMagasinSauvegardeBar(base, nomMagasin) {
    return new Promise((resolve, reject) => {
        if (!base.objectStoreNames.contains(nomMagasin)) {
            resolve([]);
            return;
        }

        const transaction = base.transaction(
            [nomMagasin],
            "readonly"
        );

        const magasin = transaction.objectStore(nomMagasin);
        const demandeDonnees = magasin.getAll();
        const demandeCles = magasin.getAllKeys();

        let donnees;
        let cles;

        demandeDonnees.onsuccess = () => {
            donnees = demandeDonnees.result;
        };

        demandeCles.onsuccess = () => {
            cles = demandeCles.result;
        };

        transaction.oncomplete = () => {
            resolve(
                (donnees || []).map((valeur, index) => ({
                    cle: cles[index],
                    valeur
                }))
            );
        };

        transaction.onerror = () => {
            reject(
                transaction.error ||
                new Error("Lecture impossible : " + nomMagasin)
            );
        };
    });
}

/* Exporter toutes les données IndexedDB */
async function exporterSauvegardeBar() {
    let base;

    try {
        messageSauvegardeBar("Préparation de la sauvegarde...");

        base = await ouvrirBaseSauvegardeBar();

        const sauvegarde = {
            application: "CHATGPT BAR PRO",
            format: VERSION_FORMAT_BAR,
            dateExport: new Date().toISOString(),
            base: NOM_BASE_BAR_SAUVEGARDE,
            magasins: {},
            stockageLocal: {}
        };

        const nomsMagasins = Array.from(base.objectStoreNames);

        for (const nom of nomsMagasins) {
            sauvegarde.magasins[nom] =
                await lireMagasinSauvegardeBar(base, nom);
        }

        /*
         * Sauvegarder l'historique des mouvements de stock
         * conservé dans localStorage par stock.js.
         */
        const historique = localStorage.getItem(
            CLE_HISTORIQUE_STOCK_BAR
        );

        if (historique !== null) {
            sauvegarde.stockageLocal[CLE_HISTORIQUE_STOCK_BAR] =
                historique;
        }

        const contenu = JSON.stringify(sauvegarde, null, 2);

        const fichier = new Blob(
            [contenu],
            { type: "application/json;charset=utf-8" }
        );

        const url = URL.createObjectURL(fichier);
        const lien = document.createElement("a");

        const date = new Date();
        const dateNom =
            date.getFullYear() + "-" +
            String(date.getMonth() + 1).padStart(2, "0") + "-" +
            String(date.getDate()).padStart(2, "0") + "_" +
            String(date.getHours()).padStart(2, "0") + "-" +
            String(date.getMinutes()).padStart(2, "0");

        lien.href = url;
        lien.download = "Sauvegarde-CHATGPT-BAR-PRO-" +
            dateNom + ".json";

        document.body.appendChild(lien);
        lien.click();
        lien.remove();

        setTimeout(() => URL.revokeObjectURL(url), 1500);

        messageSauvegardeBar(
            "Sauvegarde créée. Vérifiez que le fichier JSON " +
            "est bien enregistré sur votre téléphone."
        );
    } catch (erreur) {
        console.error(erreur);

        messageSauvegardeBar(
            "Échec de la sauvegarde : " + erreur.message,
            true
        );
    } finally {
        if (base) {
            base.close();
        }
    }
}

/* Écrire un enregistrement sans supprimer les autres */
function restaurerEnregistrementBar(
    base,
    nomMagasin,
    enregistrement
) {
    return new Promise((resolve, reject) => {
        if (!base.objectStoreNames.contains(nomMagasin)) {
            reject(
                new Error(
                    "Le magasin « " + nomMagasin +
                    " » n'existe pas dans cette version de l'application."
                )
            );
            return;
        }

        const transaction = base.transaction(
            [nomMagasin],
            "readwrite"
        );

        const magasin = transaction.objectStore(nomMagasin);

        try {
            if (magasin.keyPath !== null) {
                /*
                 * Magasin avec clé intégrée à l'objet,
                 * par exemple un champ id.
                 */
                magasin.put(enregistrement.valeur);
            } else {
                /*
                 * Magasin utilisant une clé externe.
                 */
                magasin.put(
                    enregistrement.valeur,
                    enregistrement.cle
                );
            }
        } catch (erreur) {
            reject(erreur);
            return;
        }

        transaction.oncomplete = () => resolve();

        transaction.onerror = () => {
            reject(
                transaction.error ||
                new Error("Écriture impossible : " + nomMagasin)
            );
        };

        transaction.onabort = () => {
            reject(
                transaction.error ||
                new Error("Restauration annulée : " + nomMagasin)
            );
        };
    });
}

/* Restaurer depuis un fichier JSON */
async function restaurerSauvegardeBar(fichier) {
    let base;

    try {
        if (!fichier) {
            throw new Error("Sélectionnez un fichier de sauvegarde.");
        }

        if (fichier.size > 100 * 1024 * 1024) {
            throw new Error(
                "Le fichier dépasse 100 Mo. " +
                "Utilisez une sauvegarde plus petite."
            );
        }

        messageSauvegardeBar("Vérification du fichier...");

        const texte = await fichier.text();
        const sauvegarde = JSON.parse(texte);

        if (
            sauvegarde.application !== "CHATGPT BAR PRO" ||
            sauvegarde.base !== NOM_BASE_BAR_SAUVEGARDE ||
            !sauvegarde.magasins ||
            typeof sauvegarde.magasins !== "object" ||
            Array.isArray(sauvegarde.magasins)
        ) {
            throw new Error(
                "Ce fichier n'est pas une sauvegarde reconnue " +
                "de CHATGPT BAR PRO."
            );
        }

        if (sauvegarde.format !== VERSION_FORMAT_BAR) {
            throw new Error(
                "Format de sauvegarde incompatible."
            );
        }

        /*
         * Vérifier le contenu avant toute écriture.
         */
        for (const [nom, lignes] of Object.entries(
            sauvegarde.magasins
        )) {
            if (!Array.isArray(lignes)) {
                throw new Error(
                    "Contenu invalide pour le magasin : " + nom
                );
            }

            for (const ligne of lignes) {
                if (
                    !ligne ||
                    !Object.prototype.hasOwnProperty.call(ligne, "cle") ||
                    !Object.prototype.hasOwnProperty.call(ligne, "valeur")
                ) {
                    throw new Error(
                        "Un enregistrement du fichier est invalide."
                    );
                }
            }
        }

        const confirmation = confirm(
            "Restaurer cette sauvegarde ?\n\n" +
            "Les enregistrements ayant la même clé pourront être " +
            "remplacés. Les autres enregistrements resteront présents.\n\n" +
            "Il est fortement conseillé d'exporter d'abord " +
            "une sauvegarde de l'état actuel."
        );

        if (!confirmation) {
            messageSauvegardeBar("Restauration annulée.");
            return;
        }

        base = await ouvrirBaseSauvegardeBar();

        /*
         * Vérifier tous les magasins avant de commencer.
         * Cela évite une restauration partielle liée à un magasin absent.
         */
        for (const nom of Object.keys(sauvegarde.magasins)) {
            if (!base.objectStoreNames.contains(nom)) {
                throw new Error(
                    "Le magasin « " + nom +
                    " » est absent de cette base. " +
                    "Aucune donnée n'a été restaurée."
                );
            }
        }

        let nombre = 0;

        for (const [nomMagasin, lignes] of Object.entries(
            sauvegarde.magasins
        )) {
            for (const ligne of lignes) {
                await restaurerEnregistrementBar(
                    base,
                    nomMagasin,
                    ligne
                );

                nombre++;
            }
        }

        /*
         * Restaurer l'historique local du stock.
         */
        if (
            sauvegarde.stockageLocal &&
            typeof sauvegarde.stockageLocal[
                CLE_HISTORIQUE_STOCK_BAR
            ] === "string"
        ) {
            localStorage.setItem(
                CLE_HISTORIQUE_STOCK_BAR,
                sauvegarde.stockageLocal[
                    CLE_HISTORIQUE_STOCK_BAR
                ]
            );
        }

        messageSauvegardeBar(
            "Restauration terminée : " + nombre +
            " enregistrement(s) traité(s). " +
            "Rechargez l'application pour actualiser les affichages."
        );

        alert(
            "Restauration terminée.\n\n" +
            nombre + " enregistrement(s) traité(s).\n\n" +
            "Rechargez l'application pour actualiser les affichages."
        );
    } catch (erreur) {
        console.error(erreur);

        messageSauvegardeBar(
            "Échec de la restauration : " + erreur.message,
            true
        );

        alert("Restauration impossible : " + erreur.message);
    } finally {
        if (base) {
            base.close();
        }
    }
}

/* Afficher le panneau de sauvegarde */
function afficherPanneauSauvegardeBar(conteneur) {
    if (!conteneur) {
        conteneur = document.getElementById("contenuPrincipal");
    }

    if (!conteneur) {
        messageSauvegardeBar(
            "Impossible de trouver la zone d'affichage.",
            true
        );
        return;
    }

    conteneur.innerHTML = `
        <section id="panneauSauvegardeBar"
            style="padding:15px;max-width:800px;margin:auto;">

            <h2 style="color:#d4af37;">
                Sauvegarde et restauration
            </h2>

            <p>
                Exportez régulièrement les données de votre bar
                dans un fichier JSON conservé en lieu sûr.
            </p>

            <div style="
                background:#1e1e1e;
                border:1px solid #383838;
                border-radius:10px;
                padding:15px;
                margin:15px 0;">

                <h3>1. Sauvegarder</h3>

                <p>
                    Enregistre les données présentes dans la base
                    locale de cette application.
                </p>

                <button type="button" id="boutonExporterSauvegardeBar">
                    Exporter toutes les données
                </button>
            </div>

            <div style="
                background:#1e1e1e;
                border:1px solid #383838;
                border-radius:10px;
                padding:15px;
                margin:15px 0;">

                <h3>2. Restaurer</h3>

                <label for="fichierSauvegardeBar">
                    Choisir un fichier JSON
                </label>

                <input
                    type="file"
                    id="fichierSauvegardeBar"
                    accept=".json,application/json"
                    style="
                        display:block;
                        width:100%;
                        padding:10px;
                        margin:10px 0;
                        box-sizing:border-box;
                    "
                >

                <button type="button" id="boutonRestaurerSauvegardeBar">
                    Restaurer les données
                </button>
            </div>

            <p style="color:#ffcc80;">
                Attention : protégez votre fichier de sauvegarde,
                car il peut contenir des informations commerciales
                et des comptes utilisateurs.
            </p>

            <p id="messageSauvegardeBar" aria-live="polite"></p>
        </section>
    `;

    document.getElementById(
        "boutonExporterSauvegardeBar"
    ).addEventListener("click", exporterSauvegardeBar);

    document.getElementById(
        "boutonRestaurerSauvegardeBar"
    ).addEventListener("click", async () => {
        const champ = document.getElementById(
            "fichierSauvegardeBar"
        );

        await restaurerSauvegardeBar(champ.files[0]);
    });
}

/* Fonctions accessibles depuis app.js */
window.exporterSauvegardeBar = exporterSauvegardeBar;
window.restaurerSauvegardeBar = restaurerSauvegardeBar;
window.afficherPanneauSauvegardeBar =
    afficherPanneauSauvegardeBar;
