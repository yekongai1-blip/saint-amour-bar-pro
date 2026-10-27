"use strict";
/* ==========================================
SAINT-AMOUR BAR PRO
SCANNER DE CODES-BARRES — VERSION CORRIGÉE
========================================== */
let lecteurZXing = null;
let scannerActif = false;
let lancementScanner = false;
let boutonsScannerInitialises = false;
const elementScanner = id => document.getElementById(id);
function messageScanner(texte) {
const zone = elementScanner("messageScanner");
if (zone) zone.textContent = texte;
}
async function demarrerScanner() {
if (lancementScanner || scannerActif) return;
lancementScanner = true;

const zone = elementScanner("zoneScanner");
const video = elementScanner("videoScanner");

try {
    if (!zone || !video) {
        throw new Error(
            "Zone du scanner introuvable dans index.html."
        );
    }

    if (!window.isSecureContext) {
        throw new Error(
            "La caméra nécessite une connexion sécurisée HTTPS " +
            "ou une origine locale autorisée."
        );
    }

    if (!navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia) {
        throw new Error(
            "Caméra inaccessible dans ce navigateur. " +
            "Ouvre l'application dans Chrome."
        );
    }

    if (!window.ZXing ||
        !window.ZXing.BrowserMultiFormatReader) {
        throw new Error(
            "La bibliothèque ZXing n'est pas chargée. " +
            "Vérifie Internet et le chargement de ZXing dans index.html."
        );
    }

    zone.classList.remove("cache");
    messageScanner("Demande d'accès à la caméra...");

    /* Vérifier que l'autorisation de la caméra est disponible. */
    const flux = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" } }
    });

    /* Arrêter le flux de vérification : ZXing ouvrira la caméra. */
    flux.getTracks().forEach(piste => piste.stop());

    lecteurZXing = new ZXing.BrowserMultiFormatReader();

    messageScanner(
        "Caméra prête. Présente le code-barres devant l'objectif."
    );

    scannerActif = true;

    await lecteurZXing.decodeFromVideoDevice(
        undefined,
        video,
        (resultat, erreur) => {
            if (!scannerActif || !resultat) return;

            const code = resultat.getText();

            if (!code) return;

            scannerActif = false;

            const champ = elementScanner("codeProduit");

            if (champ) {
                champ.value = code;
                champ.dispatchEvent(
                    new Event("change", { bubbles: true })
                );
            }

            arreterScanner();

            messageScanner(
                "Code détecté : " + code +
                ". Vérifie le produit, puis ajoute-le au panier."
            );
        }
    );

} catch (erreur) {
    console.error("Erreur du scanner :", erreur);

    scannerActif = false;

    if (lecteurZXing) {
        try {
            lecteurZXing.reset();
        } catch (_) {}
        lecteurZXing = null;
    }

    const texte = erreur && erreur.name === "NotAllowedError"
        ? "Accès à la caméra refusé. Autorise la caméra dans les paramètres du navigateur."
        : erreur && erreur.name === "NotFoundError"
        ? "Aucune caméra disponible sur cet appareil."
        : erreur && erreur.name === "NotReadableError"
        ? "La caméra est déjà utilisée par une autre application. Ferme-la puis réessaie."
        : erreur.message || "Impossible de démarrer le scanner.";

    messageScanner(texte);

} finally {
    lancementScanner = false;
}

}
function arreterScanner() {
scannerActif = false;
if (lecteurZXing) {
    try {
        lecteurZXing.reset();
    } catch (erreur) {
        console.warn("Arrêt ZXing :", erreur);
    }
    lecteurZXing = null;
}

const video = elementScanner("videoScanner");

if (video && video.srcObject) {
    video.srcObject.getTracks().forEach(piste => piste.stop());
    video.srcObject = null;
}

messageScanner("Scanner arrêté.");

}
function initialiserScannerZXing() {
    if (boutonsScannerInitialises) return;

    const boutonDemarrer = elementScanner("boutonScanner");
    const boutonArreter = elementScanner("arreterScanner");

    if (!boutonDemarrer) {
        console.error("Bouton boutonScanner introuvable.");
        return;
    }

    boutonDemarrer.addEventListener("click", function (evenement) {
        evenement.preventDefault();
        console.log("Clic sur Scanner détecté.");
        demarrerScanner();
    });

    if (boutonArreter) {
        boutonArreter.addEventListener("click", function (evenement) {
            evenement.preventDefault();
            arreterScanner();
        });
    }

    boutonsScannerInitialises = true;
    console.log("CHATGPT BAR PRO : boutons du scanner initialisés.");
}
/* Initialiser les boutons du scanner au chargement */
if (document.readyState === "loading") {
    document.addEventListener(
        "DOMContentLoaded",
        initialiserScannerZXing,
        { once: true }
    );
} else {
    initialiserScannerZXing();
}
