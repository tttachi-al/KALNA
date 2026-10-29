import { ChevronDown, MessagesSquare } from 'lucide-react';
import { Link } from 'react-router-dom';

const FAQS = [
  {
    q: '¿Qué es Kalna?',
    a: 'Es una herramienta que conversa contigo sobre tu trabajo para ayudarte a reconocer las competencias que ya tienes, aunque las hayas aprendido trabajando y sin certificados. Con ellas te sugiere puestos y una ruta para prepararte.',
  },
  {
    q: '¿Para qué ocupaciones sirve?',
    a: 'Por ahora se enfoca en limpieza, trabajo administrativo, reposición, ventas en tienda y caja.',
  },
  {
    q: '¿Tiene algún costo?',
    a: 'No. Usar Kalna es gratuito.',
  },
  {
    q: '¿Necesito certificados o experiencia formal?',
    a: 'No. Basta con que cuentes lo que haces o has hecho en tu trabajo. Kalna te hace preguntas y te pide ejemplos concretos para reconocer tus competencias.',
  },
  {
    q: '¿Cuánto tiempo toma el diagnóstico?',
    a: 'Unos minutos. Puedes dejarlo a medias y continuar después desde el mismo navegador.',
  },
  {
    q: '¿Qué significa «Declarada» y «Con evidencia»?',
    a: '«Declarada» es una competencia que mencionaste. Pasa a «Con evidencia» cuando la respaldas con un ejemplo concreto de tu trabajo, como una tarea que haces con frecuencia.',
  },
  {
    q: '¿Qué es el pasaporte de competencias?',
    a: 'Es un resumen de tus competencias que puedes imprimir o usar para completar tu CV y presentarte a un empleador.',
  },
  {
    q: '¿Kalna entrega una certificación oficial?',
    a: 'No. Kalna te ayuda a reconocer y ordenar lo que sabes hacer, pero no reemplaza una certificación laboral oficial.',
  },
  {
    q: '¿Dónde se guardan mis datos? ¿Puedo borrarlos?',
    a: 'Tu conversación, tu perfil y el avance de tu ruta se guardan solo en este navegador. Puedes borrarlos cuando quieras con el botón «Borrar mis datos», al pie de la página.',
  },
];

export default function FaqPage() {
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Ayuda</p>
          <h1>Preguntas frecuentes</h1>
          <p className="lead">Lo que más nos preguntan sobre Kalna y cómo funciona.</p>
        </div>
      </header>

      <div className="stack-sm">
        {FAQS.map((f) => (
          <details key={f.q} className="disclosure">
            <summary>
              {f.q}
              <ChevronDown className="chev" aria-hidden="true" />
            </summary>
            <div className="disclosure-body">
              <p className="muted">{f.a}</p>
            </div>
          </details>
        ))}
      </div>

      <section className="card stack-sm">
        <h2>¿Listo para empezar?</h2>
        <p className="muted">Conversa con Kalna sobre tu experiencia y descubre tus competencias.</p>
        <div>
          <Link to="/diagnostico" className="btn btn-primary">
            <MessagesSquare aria-hidden="true" />
            Empezar diagnóstico
          </Link>
        </div>
      </section>
    </div>
  );
}
