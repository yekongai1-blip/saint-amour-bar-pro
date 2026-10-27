"use strict";

(function () {
    const indicateur = document.getElementById("etatConnexion");

    if (!indicateur) return;

    let etatPrecedent = navigator.onLine;

    function afficherEtat(enLigne, notifier) {
        indicateur.textContent = enLigne
            ? "🟢 EN LIGNE"
            : "🔴 HORS CONNEXION";

        indicateur.style.backgroundColor = enLigne
            ? "#173d2b"
            : "#5a2020";

        indicateur.style.color = "#ffffff";

        if (notifier && etatPrecedent !== enLigne) {
            const message = enLigne
                ? "Connexion Internet rétablie."
                : "Connexion Internet perdue.";

            if ("Notification" in window &&
                Notification.permission === "granted") {
                try {
                    new Notification("SAINT-AMOUR BAR PRO", {
                        body: message
                    });
                } catch (_) {
                    console.log(message);
                }
            } else {
                console.log(message);
            }
        }

        etatPrecedent = enLigne;
    }

    window.addEventListener("online", function () {
        afficherEtat(true, true);
    });

    window.addEventListener("offline", function () {
        afficherEtat(false, true);
    });

    afficherEtat(navigator.onLine, false);
})();
