"use strict";

/* ==========================================
   CHATGPT BAR PRO
   Base locale IndexedDB — diagnostic sécurisé
   ========================================== */

const DB_NOM = "ChatGPTBarProDB";
const DB_VERSION = 1;

let connexionDB = null;

const TABLES = [
    "produits",
    "ventes",
    "depenses",
    "utilisateurs",
    "mouvementsStock",
    "dettes",
    "fournisseurs",
    "journal"
];

/* Ouvrir la base existante */
function ouvrirBase() {
    return new Promise((resolve, reject) => {
        if (connexionDB) {
            if (connexionDB.objectStoreNames.length > 0) {
                resolve(connexionDB);
                return;
            }

            connexionDB = null;
        }

        if (!window.indexedDB) {
            reject(new Error(
                "IndexedDB n'est pas disponible dans ce navigateur."
            ));
            return;
        }

        const demande = indexedDB.open(DB_NOM, DB_VERSION);

        demande.onupgradeneeded = function (event) {
            const db = event.target.result;

            TABLES.forEach(nom => {
                if (!db.objectStoreNames.contains(nom)) {
                    const options = { keyPath: "id" };

                    if (nom !== "utilisateurs") {
                        options.autoIncrement = true;
                    }

                    db.createObjectStore(nom, options);
                }
            });
        };

        demande.onsuccess = function (event) {
            connexionDB = event.target.result;

            connexionDB.onversionchange = function () {
                connexionDB.close();
                connexionDB = null;
            };

            console.log(
                "Base ouverte :",
                DB_NOM,
                "| Tables :",
                Array.from(connexionDB.objectStoreNames)
            );

            resolve(connexionDB);
        };

        demande.onerror = function () {
            const erreur = demande.error ||
                new Error("Impossible d'ouvrir la base.");

            console.error("Ouverture IndexedDB impossible :", erreur);
            reject(erreur);
        };

        demande.onblocked = function () {
            console.warn(
                "Ouverture bloquée : fermez les autres onglets de l'application."
            );
        };
    });
}

/* Ajouter un enregistrement */
async function ajouterEnregistrement(table, donnees) {
    const db = await ouvrirBase();

    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(table)) {
            reject(new Error("Table inexistante : " + table));
            return;
        }

        const transaction = db.transaction(table, "readwrite");
        const demande = transaction.objectStore(table).add(donnees);

        demande.onsuccess = () => resolve(demande.result);
        demande.onerror = () => reject(demande.error);

        transaction.onabort = () => {
            reject(transaction.error ||
                new Error("Ajout annulé dans la table " + table));
        };
    });
}

/* Lire tous les enregistrements */
async function lireTous(table) {
    const db = await ouvrirBase();

    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(table)) {
            reject(new Error("Table inexistante : " + table));
            return;
        }

        const transaction = db.transaction(table, "readonly");
        const demande = transaction.objectStore(table).getAll();

        demande.onsuccess = () => {
            const resultats = demande.result || [];

            console.log(
                "Lecture IndexedDB :",
                table,
                "=",
                resultats.length,
                "enregistrement(s)"
            );

            resolve(resultats);
        };

        demande.onerror = () => {
            console.error("Erreur de lecture de la table :", table,
                demande.error);
            reject(demande.error);
        };

        transaction.onabort = () => {
            reject(transaction.error ||
                new Error("Lecture interrompue : " + table));
        };
    });
}

/* Lire un enregistrement par identifiant */
async function lireParId(table, id) {
    const db = await ouvrirBase();

    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(table)) {
            reject(new Error("Table inexistante : " + table));
            return;
        }

        const transaction = db.transaction(table, "readonly");
        const demande = transaction.objectStore(table).get(id);

        demande.onsuccess = () => resolve(demande.result);
        demande.onerror = () => reject(demande.error);
    });
}

/* Modifier un enregistrement */
async function modifierEnregistrement(table, donnees) {
    const db = await ouvrirBase();

    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(table)) {
            reject(new Error("Table inexistante : " + table));
            return;
        }

        const transaction = db.transaction(table, "readwrite");
        const demande = transaction.objectStore(table).put(donnees);

        demande.onsuccess = () => resolve(demande.result);
        demande.onerror = () => reject(demande.error);
    });
}

/* Supprimer un enregistrement */
async function supprimerEnregistrement(table, id) {
    const db = await ouvrirBase();

    return new Promise((resolve, reject) => {
        if (!db.objectStoreNames.contains(table)) {
            reject(new Error("Table inexistante : " + table));
            return;
        }

        const transaction = db.transaction(table, "readwrite");
        const demande = transaction.objectStore(table).delete(id);

        demande.onsuccess = () => resolve(true);
        demande.onerror = () => reject(demande.error);
    });
}

/* Rechercher un produit par code-barres */
async function rechercherParCode(code) {
    const produits = await lireTous("produits");

    return produits.find(
        produit => String(produit.codeBarres) === String(code)
    ) || null;
}

/* Diagnostic des données, sans rien supprimer */
async function diagnostiquerBase() {
    const resultat = {};

    for (const table of TABLES) {
        try {
            const donnees = await lireTous(table);
            resultat[table] = donnees.length;
        } catch (erreur) {
            resultat[table] = "ERREUR : " + erreur.message;
        }
    }

    console.table(resultat);
    return resultat;
}

/* Initialiser la base */
async function initialiserBase() {
    try {
        await ouvrirBase();
        console.log("CHATGPT BAR PRO : base locale prête.");
        return true;
    } catch (erreur) {
        console.error("Erreur de base de données :", erreur);
        throw erreur;
    }
}
/* TEST TEMPORAIRE : vérifier les données enregistrées */
async function testerDonneesBar() {
    try {
        const produits = await lireTous("produits");
        const ventes = await lireTous("ventes");

        alert(
            "DIAGNOSTIC CHATGPT BAR PRO\n\n" +
            "Produits enregistrés : " + produits.length + "\n" +
            "Ventes enregistrées : " + ventes.length + "\n\n" +
            "Consulte la console pour plus de détails."
        );

        console.log("PRODUITS ENREGISTRÉS :", produits);
        console.log("VENTES ENREGISTRÉES :", ventes);

    } catch (erreur) {
        console.error("ÉCHEC DU DIAGNOSTIC :", erreur);
        alert("Erreur de diagnostic : " + erreur.message);
    }
}
window.testerConnexionSupabase = async function () {
    const client = obtenirClientSupabase();

    if (!client) {
        console.error("Supabase n'est pas initialisé.");
        return false;
    }

    const { data, error } = await client
        .from("bar_appareils")
        .select("id")
        .limit(1);

    if (error) {
        console.error("Erreur de connexion Supabase :", error.message);
        return false;
    }

    console.log("Connexion Supabase réussie.", data);
    return true;
};
