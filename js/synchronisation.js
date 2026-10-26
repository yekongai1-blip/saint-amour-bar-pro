"use strict";

/* ==========================================
   SAINT-AMOUR BAR PRO
   Synchronisation des six tables Supabase
   Compatible avec IndexedDB existant
   ========================================== */

(function () {
    const TABLES_SYNC = [
        {
            local: "produits",
            cloud: "bar_produits",
            roles: ["directeur", "stock"]
        },
        {
            local: "ventes",
            cloud: "bar_ventes",
            roles: ["directeur", "caissier"]
        },
        {
            local: "depenses",
            cloud: "bar_depenses",
            roles: ["directeur"]
        },
        {
            local: "mouvementsStock",
            cloud: "bar_mouvements_stock",
            roles: ["directeur", "stock"]
        },
        {
            local: "dettes",
            cloud: "bar_dettes",
            roles: ["directeur", "caissier"]
        },
        {
            local: "fournisseurs",
            cloud: "bar_fournisseurs",
            roles: ["directeur", "stock"]
        }
    ];

    let operationEnCours = false;

    function obtenirClient() {
        return window.clientSupabase || null;
    }

    function creerIdentifiant() {
        if (
            window.crypto &&
            typeof window.crypto.randomUUID === "function"
        ) {
            return window.crypto.randomUUID();
        }

        throw new Error(
            "Impossible de créer un identifiant sécurisé. " +
            "Ouvre l'application dans une version récente de Chrome."
        );
    }

    async function obtenirProfil() {
        const client = obtenirClient();

        if (!client) {
            throw new Error("Supabase n'est pas initialisé.");
        }

        const {
            data: sessionData,
            error: sessionError
        } = await client.auth.getSession();

        if (sessionError) {
            throw new Error(
                "Erreur de session : " + sessionError.message
            );
        }

        const session = sessionData.session;

        if (!session || !session.user) {
            throw new Error(
                "Aucune session active. Reconnecte-toi."
            );
        }

        const {
            data: profil,
            error: profilError
        } = await client
            .from("bar_profils")
            .select(
                "id, nom, role, actif, caisse_id, emplacement_stock_id"
            )
            .eq("id", session.user.id)
            .maybeSingle();

        if (profilError) {
            throw new Error(
                "Impossible de récupérer le profil : " +
                profilError.message
            );
        }

        if (!profil || profil.actif !== true) {
            throw new Error(
                "Profil introuvable ou compte désactivé."
            );
        }

        if (!profil.caisse_id) {
            throw new Error(
                "Ton compte n'est associé à aucune caisse."
            );
        }

        window.utilisateurBarConnecte = {
            uid: session.user.id,
            email: session.user.email,
            nom: profil.nom,
            role: profil.role,
            actif: profil.actif,
            caisse_id: profil.caisse_id,
            emplacement_stock_id: profil.emplacement_stock_id
        };

        return window.utilisateurBarConnecte;
    }

    /*
     * Chaque enregistrement local reçoit un identifiant cloud
     * distinct de son identifiant numérique IndexedDB.
     */
    function obtenirIdentifiantCloud(enregistrement) {
        if (!enregistrement._sync_id) {
            enregistrement._sync_id = creerIdentifiant();
        }

        return enregistrement._sync_id;
    }

    function dateModification(enregistrement) {
        const valeur =
            enregistrement.modifie_le ||
            enregistrement.dateModification ||
            enregistrement.dateCreation ||
            enregistrement.date ||
            null;

        if (!valeur) return 0;

        const temps = new Date(valeur).getTime();

        return Number.isFinite(temps) ? temps : 0;
    }

    function compterEnregistrements(donnees) {
        return Object.values(donnees).reduce(
            (total, liste) => total + liste.length,
            0
        );
    }

    /*
     * Synchronise une table locale avec sa table Supabase.
     *
     * L'identifiant local IndexedDB est préservé.
     * L'identifiant cloud est stocké dans _sync_id.
     */
    async function synchroniserUneTable(
        client,
        configuration,
        caisseId
    ) {
        const nomLocal = configuration.local;
        const nomCloud = configuration.cloud;

        let locaux = await lireTous(nomLocal);

        if (!Array.isArray(locaux)) {
            locaux = [];
        }

        /*
         * 1. Préparer les identifiants des enregistrements locaux.
         */
        for (const element of locaux) {
            if (!element._sync_id) {
                element._sync_id = creerIdentifiant();

                await modifierEnregistrement(
                    nomLocal,
                    element
                );
            }
        }

        /*
         * 2. Récupérer les enregistrements cloud de cette caisse.
         */
        const {
            data: lignesCloud,
            error: lectureErreur
        } = await client
            .from(nomCloud)
            .select("id, donnees, modifie_le")
            .eq("caisse_id", caisseId);

        if (lectureErreur) {
            throw new Error(
                "Lecture de " + nomCloud + " impossible : " +
                lectureErreur.message
            );
        }

        const cloud = Array.isArray(lignesCloud)
            ? lignesCloud
            : [];

        /*
         * 3. Fusionner les données déjà présentes sur les deux côtés.
         *
         * En cas de conflit, l'enregistrement le plus récent est
         * conservé lorsque les dates sont disponibles.
         *
         * Si les dates sont identiques ou absentes, la donnée locale
         * est conservée.
         */
        const indexCloud = new Map();

        for (const ligne of cloud) {
            if (ligne.id) {
                indexCloud.set(ligne.id, ligne);
            }
        }

        const indexLocal = new Map();

        for (const element of locaux) {
            indexLocal.set(element._sync_id, element);
        }

        /*
         * 4. Envoyer les données locales nouvelles ou modifiées.
         */
        let envoyes = 0;

        for (const element of locaux) {
            const idCloud = element._sync_id;
            const ligneExistante = indexCloud.get(idCloud);

            let donneesAEnvoyer = element;

            if (ligneExistante && ligneExistante.donnees) {
                const dateLocale = dateModification(element);
                const dateDistante = dateModification(
                    ligneExistante.donnees
                );

                if (dateDistante > dateLocale) {
                    /*
                     * La version cloud est plus récente :
                     * elle sera appliquée à l'étape de fusion.
                     */
                    continue;
                }
            }

            const maintenant = new Date().toISOString();

            donneesAEnvoyer = {
                ...donneesAEnvoyer,
                _sync_id: idCloud,
                modifie_le: maintenant
            };

            const ligne = {
                id: idCloud,
                caisse_id: caisseId,
                donnees: donneesAEnvoyer,
                modifie_le: maintenant
            };

            const {
                error: envoiErreur
            } = await client
                .from(nomCloud)
                .upsert(
                    ligne,
                    { onConflict: "id" }
                );

            if (envoiErreur) {
                throw new Error(
                    "Envoi vers " + nomCloud +
                    " impossible : " + envoiErreur.message
                );
            }

            envoyes++;
        }

        /*
         * 5. Relire le cloud après les envois.
         */
        const {
            data: donneesDistantes,
            error: nouvelleLectureErreur
        } = await client
            .from(nomCloud)
            .select("id, donnees, modifie_le")
            .eq("caisse_id", caisseId);

        if (nouvelleLectureErreur) {
            throw new Error(
                "Téléchargement depuis " + nomCloud +
                " impossible : " +
                nouvelleLectureErreur.message
            );
        }

        const lignesFinales = Array.isArray(donneesDistantes)
            ? donneesDistantes
            : [];

        /*
         * 6. Télécharger les éléments absents et mettre à jour
         * les éléments cloud plus récents.
         */
        locaux = await lireTous(nomLocal);

        if (!Array.isArray(locaux)) {
            locaux = [];
        }

        const locauxParSyncId = new Map();

        for (const element of locaux) {
            if (element._sync_id) {
                locauxParSyncId.set(
                    element._sync_id,
                    element
                );
            }
        }

        let recus = 0;
        let actualises = 0;

        for (const ligne of lignesFinales) {
            if (!ligne.id || !ligne.donnees) continue;

            const elementCloud = {
                ...ligne.donnees,
                _sync_id: ligne.id
            };

            const elementLocal = locauxParSyncId.get(ligne.id);

            if (elementLocal) {
                const dateLocale = dateModification(elementLocal);
                const dateDistante = dateModification(elementCloud);

                if (dateDistante > dateLocale) {
                    const fusion = {
                        ...elementCloud,
                        id: elementLocal.id
                    };

                    await modifierEnregistrement(
                        nomLocal,
                        fusion
                    );

                    actualises++;
                }
            } else {
                /*
                 * Ne jamais réutiliser l'identifiant numérique
                 * d'un autre téléphone.
                 */
                delete elementCloud.id;

                await ajouterEnregistrement(
                    nomLocal,
                    elementCloud
                );

                recus++;
            }
        }

        return {
            table: nomLocal,
            envoyes,
            recus,
            actualises,
            totalCloud: lignesFinales.length
        };
    }

    /*
     * Synchronisation des six tables.
     */
    async function synchroniserTout() {
        if (operationEnCours) {
            throw new Error(
                "Une synchronisation est déjà en cours."
            );
        }

        operationEnCours = true;

        try {
            const client = obtenirClient();

            if (!client) {
                throw new Error(
                    "Supabase n'est pas initialisé."
                );
            }

            await ouvrirBase();

            const profil = await obtenirProfil();
            const caisseId = profil.caisse_id;

            const resultats = [];
            const erreurs = [];

            for (const configuration of TABLES_SYNC) {
                /*
                 * Le rôle détermine les tables que l'utilisateur
                 * est autorisé à synchroniser.
                 */
                if (
                    !configuration.roles.includes(profil.role)
                ) {
                    continue;
                }

                try {
                    const resultat = await synchroniserUneTable(
                        client,
                        configuration,
                        caisseId
                    );

                    resultats.push(resultat);
                } catch (erreur) {
                    erreurs.push(
                        configuration.local + " : " + erreur.message
                    );
                }
            }

            /*
             * Actualiser les écrans, si les fonctions existent.
             */
            if (
                typeof window.afficherProduitsBar === "function"
            ) {
                try {
                    await window.afficherProduitsBar();
                } catch (erreur) {
                    console.warn(
                        "Actualisation des produits impossible :",
                        erreur
                    );
                }
            }

            if (
                typeof window.actualiserStatistiques === "function"
            ) {
                try {
                    await window.actualiserStatistiques();
                } catch (erreur) {
                    console.warn(
                        "Actualisation des statistiques impossible :",
                        erreur
                    );
                }
            }

            return {
                resultats,
                erreurs
            };
        } finally {
            operationEnCours = false;
        }
    }

    /*
     * Ancienne fonction conservée pour compatibilité.
     */
    async function synchroniserProduits() {
        const resultat = await synchroniserTout();

        const produits = resultat.resultats.find(
            element => element.table === "produits"
        );

        if (!produits) {
            throw new Error(
                "Le rôle de ce compte ne permet pas de synchroniser les produits."
            );
        }

        return {
            envoyes: produits.envoyes,
            recus: produits.recus
        };
    }

    /*
     * Lire toutes les données locales pour la sauvegarde.
     */
    async function lireDonneesLocales() {
        await ouvrirBase();

        const donnees = {};

        for (const table of TABLES_SYNC) {
            donnees[table.local] = await lireTous(
                table.local
            );
        }

        const total = compterEnregistrements(donnees);

        return {
            donnees,
            total
        };
    }

    async function sauvegarderVersSupabase() {
        const client = obtenirClient();

        if (!client) {
            throw new Error(
                "Supabase n'est pas initialisé."
            );
        }

        const profil = await obtenirProfil();

        const {
            data: sessionData,
            error: sessionError
        } = await client.auth.getSession();

        if (sessionError) {
            throw new Error(sessionError.message);
        }

        const session = sessionData.session;

        if (!session) {
            throw new Error(
                "Connecte-toi à Supabase avant la sauvegarde."
            );
        }

        const {
            donnees,
            total
        } = await lireDonneesLocales();

        const sauvegarde = {
            version: 1,
            application: "SAINT-AMOUR BAR PRO",
            date: new Date().toISOString(),
            caisse_id: profil.caisse_id,
            donnees
        };

        const {
            data,
            error
        } = await client
            .from("bar_sauvegardes")
            .insert({
                utilisateur_id: session.user.id,
                donnees: sauvegarde,
                nombre_enregistrements: total
            })
            .select(
                "id,date_sauvegarde,nombre_enregistrements"
            )
            .single();

        if (error) {
            throw new Error(
                "Échec de la sauvegarde : " + error.message
            );
        }

        return data;
    }

    async function listerSauvegardes() {
        const client = obtenirClient();

        if (!client) {
            throw new Error(
                "Supabase n'est pas initialisé."
            );
        }

        const {
            data: sessionData,
            error: sessionError
        } = await client.auth.getSession();

        if (sessionError) {
            throw new Error(sessionError.message);
        }

        if (!sessionData.session) {
            throw new Error(
                "Connecte-toi à Supabase."
            );
        }

        const {
            data,
            error
        } = await client
            .from("bar_sauvegardes")
            .select(
                "id,date_sauvegarde,nombre_enregistrements"
            )
            .order(
                "date_sauvegarde",
                { ascending: false }
            );

        if (error) {
            throw new Error(
                "Impossible de lire les sauvegardes : " +
                error.message
            );
        }

        return data || [];
    }

    async function afficherEtatSynchronisation(conteneur) {
        const zone = typeof conteneur === "string"
            ? document.getElementById(conteneur)
            : conteneur;

        if (!zone) {
            throw new Error(
                "Zone de synchronisation introuvable."
            );
        }

        zone.innerHTML = `
            <h2>Synchronisation et sauvegarde</h2>

            <p>
                Connecte-toi à Internet pour synchroniser
                les données autorisées de ta caisse.
            </p>

            <button
                id="boutonSynchroniserTout"
                type="button">
                Synchroniser toutes les tables
            </button>

            <button
                id="boutonSauvegarderCloud"
                type="button">
                Sauvegarder maintenant
            </button>

            <button
                id="boutonHistoriqueCloud"
                type="button">
                Voir les sauvegardes
            </button>

            <p id="messageSauvegardeCloud" role="status">
                Prêt.
            </p>

            <div id="resultatsSynchronisation"></div>

            <div id="historiqueSauvegardesCloud"></div>
        `;

        const boutonSync = zone.querySelector(
            "#boutonSynchroniserTout"
        );

        const boutonSauvegarder = zone.querySelector(
            "#boutonSauvegarderCloud"
        );

        const boutonHistorique = zone.querySelector(
            "#boutonHistoriqueCloud"
        );

        const message = zone.querySelector(
            "#messageSauvegardeCloud"
        );

        const resultatsZone = zone.querySelector(
            "#resultatsSynchronisation"
        );

        const historique = zone.querySelector(
            "#historiqueSauvegardesCloud"
        );

        boutonSync.addEventListener("click", async () => {
            if (operationEnCours) return;

            boutonSync.disabled = true;
            message.textContent =
                "Synchronisation des tables en cours…";

            resultatsZone.replaceChildren();

            try {
                const resultat = await synchroniserTout();

                const liste = document.createElement("ul");

                for (const ligne of resultat.resultats) {
                    const item = document.createElement("li");

                    item.textContent =
                        ligne.table +
                        " : " + ligne.envoyes + " envoyé(s), " +
                        ligne.recus + " reçu(s), " +
                        ligne.actualises + " actualisé(s).";

                    liste.appendChild(item);
                }

                resultatsZone.appendChild(liste);

                if (resultat.erreurs.length > 0) {
                    message.textContent =
                        "Synchronisation partielle : certaines tables " +
                        "n'ont pas pu être synchronisées.";

                    const erreurs = document.createElement("ul");

                     resultat.erreurs.forEach(texte => {
                        const item = document.createElement("li");
                        item.textContent = texte;
                        erreurs.appendChild(item);
                    });

                    resultatsZone.appendChild(erreurs);
                } else {
                    message.textContent =
                        "Synchronisation terminée pour toutes les " +
                        "tables autorisées à ce compte.";
                }
            } catch (erreur) {
                console.error(erreur);
                message.textContent = erreur.message;
            } finally {
                boutonSync.disabled = false;
            }
        });

        boutonSauvegarder.addEventListener("click", async () => {
            if (operationEnCours) return;

            if (!window.confirm(
                "Envoyer une copie des données locales vers Supabase ?"
            )) {
                return;
            }

            boutonSauvegarder.disabled = true;
            message.textContent = "Sauvegarde en cours…";

            try {
                const resultat =
                    await sauvegarderVersSupabase();

                message.textContent =
                    "Sauvegarde réussie le " +
                    new Date(resultat.date_sauvegarde)
                        .toLocaleString() +
                    " — " +
                    resultat.nombre_enregistrements +
                    " enregistrements sauvegardés.";

                historique.replaceChildren();
            } catch (erreur) {
                console.error(erreur);
                message.textContent = erreur.message;
            } finally {
                boutonSauvegarder.disabled = false;
            }
        });

        boutonHistorique.addEventListener("click", async () => {
            if (operationEnCours) return;

            boutonHistorique.disabled = true;
            message.textContent =
                "Chargement de l'historique…";

            try {
                const liste = await listerSauvegardes();

                historique.replaceChildren();

                if (liste.length === 0) {
                    historique.textContent =
                        "Aucune sauvegarde enregistrée.";
                } else {
                    const titre = document.createElement("h3");
                    titre.textContent =
                        "Sauvegardes disponibles";

                    historique.appendChild(titre);

                    const ul = document.createElement("ul");

                    liste.forEach(element => {
                        const li = document.createElement("li");

                        li.textContent =
                            new Date(element.date_sauvegarde)
                                .toLocaleString() +
                            " — " +
                            element.nombre_enregistrements +
                            " enregistrements";

                        ul.appendChild(li);
                    });

                    historique.appendChild(ul);
                }

                message.textContent = "Historique chargé.";
            } catch (erreur) {
                console.error(erreur);
                message.textContent = erreur.message;
            } finally {
                boutonHistorique.disabled = false;
            }
        });
    }

    window.BarSynchronisation = {
        sauvegarderVersSupabase,
        listerSauvegardes,
        synchroniserProduits,
        synchroniserTout,
        afficherEtatSynchronisation
    };
})();
          
