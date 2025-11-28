import React from 'react';

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

function RedirectToHome() {
    window.location.href = "/";
}

export function AuthErrorPage() {
    return (
        <main className="min-h-screen text-center flex items-center justify-center text-red-200">
            <p>
                Authentifizierung fehlgeschlagen. Bitte versuchen Sie es später erneut.
                <br></br>
                Sie werden in <Countdown seconds={5} onComplete={RedirectToHome} /> Sekunden zurück zur Startseite geleitet.
            </p>
        </main>
    );
}