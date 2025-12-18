import * as React from "react";
import { authenticateGithub } from "../services";
import { Routes, navigateTo } from "../config/routes";

function GithubCallbackPage() {
  React.useEffect(() => {
    const params = new URLSearchParams(globalThis.location.search);
    const code = params.get('code');
    const state = params.get('state');

    if (code && state) {
      authenticateGithub(code, state).then(user => {
          localStorage.setItem('user', JSON.stringify(user));
          navigateTo(Routes.Home);
        }).catch((error) => {
          console.error(error);
          navigateTo(Routes.Callback.Error);
        });
    } else {
      console.error("Missing code or state in GitHub callback URL");
      navigateTo(Routes.Callback.Error);
    }
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-slate-900 text-slate-200">
      <p>Authentifizierung läuft...</p>
    </main>
  );
};

function Countdown({ seconds, onComplete }) {
    const [timeLeft, setTimeLeft] = React.useState(seconds);

    React.useEffect(() => {
        if (timeLeft <= 0) {
            onComplete();
            return;
        }

        const timerId = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timerId);
    }, [timeLeft, onComplete]);

    return <span>{timeLeft}</span>;
}

function AuthErrorPage() {
    return (
        <main className="min-h-screen text-center flex items-center justify-center text-red-200">
            <p>
                Authentifizierung fehlgeschlagen. Bitte versuchen Sie es später erneut.
                <br></br>
                Sie werden in <Countdown seconds={5} onComplete={() => navigateTo(Routes.Home)} /> Sekunden zurück zur Startseite geleitet.
            </p>
        </main>
    );
}

export { GithubCallbackPage, AuthErrorPage };