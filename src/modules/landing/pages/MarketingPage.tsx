import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

import heroDashboard from '@modules/landing/assets/hero-dashboard.svg';
import financeOverview from '@modules/landing/assets/finance-overview.svg';
import tasksFocus from '@modules/landing/assets/tasks-focus.svg';

import styles from './MarketingPage.module.css';

const heroHighlights = [
  'Copiloto inteligente para autônomos e creators',
  'Fluxos cruzando finanças, CRM, tarefas e agenda',
  'Modo visitante gratuito · Cloud a partir de R$ 9,90',
];

const proofPoints = [
  { value: '+1.5k h', label: 'organizadas em 2024' },
  { value: '98%', label: 'dos usuários recomendariam o PAI' },
  { value: '7 apps', label: 'integrados no cockpit' },
];

const featureCards = [
  {
    title: 'Finanças inteligentes',
    description:
      'Saldo projetado, exclusão de lançamentos não contabilizados e alertas semanais para decisões rápidas.',
  },
  {
    title: 'Foco e produtividade',
    description:
      'Tarefas com matriz de prioridade, Pomodoro integrado, gamificação e sincronização direta com o calendário.',
  },
  {
    title: 'CRM pessoal completo',
    description:
      'Pipeline visual com estágios, prioridades, próximos passos e histórico de interações para nunca perder um follow-up.',
  },
  {
    title: 'Automações sem código',
    description:
      'Conecte finanças, notas, tarefas, calendário e ponto com gatilhos “se acontecer X, crie Y” em minutos.',
  },
];

const visualBlocks = [
  {
    title: 'Cockpit financeiro com saldo projetado',
    text: 'Veja o mês atual, identifique reembolsos ignorados e receba alertas de caixa em uma única tela.',
    image: financeOverview,
  },
  {
    title: 'Foco acionável com timer integrado',
    text: 'Matriz de prioridade, Pomodoro e calendário trabalhando juntos para manter sua energia onde importa.',
    image: tasksFocus,
  },
];

const moduleHighlights = [
  'Finanças e investimentos',
  'Tarefas & foco (Pomodoro incluso)',
  'Calendário inteligente',
  'Controle de ponto',
  'Notas e base pessoal',
  'Relacionamentos (CRM)',
  'Automações entre módulos',
];

const testimonials = [
  {
    quote:
      '“O PAI virou meu cockpit diário. Em 10 minutos sei o saldo do mês, quem devo contatar e qual tarefa precisa de foco.”',
    author: 'Julia Ferraz — Consultora de branding',
  },
  {
    quote:
      '“Abandonei cinco planilhas. O modo visitante convence e o cloud mantém tudo em um histórico confiável.”',
    author: 'Pedro Campos — Mentor financeiro',
  },
];

const faqItems = [
  {
    question: 'Preciso inserir cartão para testar?',
    answer:
      'Não. O modo visitante roda localmente e não exige pagamento. Quando quiser sincronizar na nuvem, basta assinar.',
  },
  {
    question: 'Quais módulos estão inclusos?',
    answer:
      'Todos: finanças, tarefas, calendário, ponto, notas, CRM e automações. Nada é vendido à parte.',
  },
  {
    question: 'Posso cancelar quando quiser?',
    answer: 'Sim. O plano cloud custa R$ 9,90/mês, com 14 dias de garantia.',
  },
  {
    question: 'Existe suporte?',
    answer:
      'Usuários cloud contam com suporte por e-mail e roadmap público. Visitantes têm base gratuita de conhecimento.',
  },
];

const trustLogos = [
  'Freelancers financeiros',
  'Agências boutique',
  'Consultores independentes',
  'Creators de educação',
];

const MarketingPage = () => {
  const navigate = useNavigate();
  const memoizedProof = useMemo(() => proofPoints, []);
  const goTo = (path: string) => () => navigate(path);

  return (
    <div className={styles.wrapper}>
      <header className={styles.hero}>
        <div className={styles.heroContent}>
          <span className={styles.badge}>PAI · Painel Administrativo Inteligente</span>
          <h1>Centralize finanças, foco, agenda e relacionamentos em um cockpit inteligente.</h1>
          <p>
            O PAI conecta tudo que você usa para tocar seu negócio solo: dinheiro, tempo, clientes e
            automações. Tenha clareza diária sem planilhas e ganhe horas livres por semana.
          </p>
          <ul className={styles.heroList}>
            <li>Modo visitante gratuito · Cloud com backup e automações</li>
            <li>Saldo projetado, tarefas com Pomodoro, CRM pessoal e calendário inteligente</li>
            <li>Controle de ponto, notas conectadas e gatilhos sem código</li>
          </ul>
          <div className={styles.heroCTA}>
            <button type="button" onClick={goTo('/assinatura')}>
              Assinar o PAI agora
            </button>
            <button type="button" className={styles.secondaryButton} onClick={goTo('/dashboard')}>
              Testar como visitante
            </button>
          </div>
        </div>
        <figure className={styles.heroVisual}>
          <img src={heroDashboard} alt="Dashboard do PAI com cards conectados" loading="lazy" />
        </figure>
      </header>

      <section className={styles.trustBar}>
        <p>O PAI já organiza o dia a dia de:</p>
        <div>
          {trustLogos.map(item => (
            <span key={item}>{item}</span>
          ))}
        </div>
      </section>

      <section className={styles.evidence}>
        <h2>Resultados que sustentam a promessa</h2>
        <div className={styles.statsRow}>
          {memoizedProof.map(proof => (
            <article key={proof.label} className={styles.statCard}>
              <strong>{proof.value}</strong>
              <span>{proof.label}</span>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.features}>
        <h2>O que você recebe ao ativar o PAI</h2>
        <div className={styles.featureGrid}>
          {featureCards.map(card => (
            <article key={card.title} className={styles.featureCard}>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.visualShowcase}>
        {visualBlocks.map(block => (
          <article key={block.title} className={styles.visualCard}>
            <div>
              <span className={styles.evidenceTag}>Veja em ação</span>
              <h3>{block.title}</h3>
              <p>{block.text}</p>
            </div>
            <figure>
              <img src={block.image} alt={block.title} loading="lazy" />
            </figure>
          </article>
        ))}
      </section>

      <section className={styles.modules}>
        <div>
          <h2>Todos os módulos conectados</h2>
          <p>
            O painel conversa internamente. Um gasto pode gerar uma tarefa, enviar uma nota ou criar
            um follow-up. Tudo sem integrações externas.
          </p>
        </div>
        <ul>
          {moduleHighlights.map(item => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className={styles.testimonials}>
        {testimonials.map(testimonial => (
          <blockquote key={testimonial.author}>
            <p>{testimonial.quote}</p>
            <footer>{testimonial.author}</footer>
          </blockquote>
        ))}
      </section>

      <section className={styles.pricing}>
        <div>
          <h2>Escolha como começar</h2>
          <p>Experimente agora como visitante ou ative o plano cloud com garantia.</p>
        </div>
        <div className={styles.pricingGrid}>
          <article className={styles.pricingCard}>
            <h3>Modo Visitante</h3>
            <p>Ideal para testar em segundos.</p>
            <ul>
              <li>Funciona 100% local</li>
              <li>Sem cadastro de cartão</li>
              <li>Perfeito para validação rápida</li>
            </ul>
            <button type="button" onClick={goTo('/dashboard')}>
              Entrar como visitante
            </button>
          </article>
          <article className={styles.pricingCard}>
            <span className={styles.popularTag}>Mais vendido</span>
            <h3>Plano Cloud</h3>
            <p>Para quem quer histórico e automações.</p>
            <div className={styles.priceRow}>
              <span className={styles.price}>R$ 9,90</span>
              <span className={styles.priceDetail}>/mês · 14 dias de garantia</span>
            </div>
            <ul>
              <li>Todos os módulos conectados</li>
              <li>Automação entre apps internos</li>
              <li>Backup em nuvem e suporte</li>
            </ul>
            <button type="button" onClick={goTo('/assinatura')}>
              Assinar o PAI
            </button>
          </article>
        </div>
      </section>

      <section className={styles.faq}>
        <h2>Dúvidas frequentes</h2>
        <div className={styles.faqGrid}>
          {faqItems.map(item => (
            <article key={item.question}>
              <h3>{item.question}</h3>
              <p>{item.answer}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.finalCTA}>
        <h2>Coloque o PAI para trabalhar por você hoje.</h2>
        <p>
          Economize horas por semana, tenha clareza sobre dinheiro, tempo e clientes e automatize as
          rotinas mais cansativas. Experimente sem cartão ou ative o plano cloud com garantia.
        </p>
        <div className={styles.finalButtons}>
          <button type="button" onClick={goTo('/assinatura')}>
            Quero assinar o PAI
          </button>
          <button type="button" className={styles.secondaryButton} onClick={goTo('/dashboard')}>
            Prefiro testar primeiro
          </button>
        </div>
      </section>
    </div>
  );
};

export { MarketingPage };
