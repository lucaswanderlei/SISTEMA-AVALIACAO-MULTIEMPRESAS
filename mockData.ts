import { RestaurantSettings, RewardOption, Review, Waiter } from '../types';

export const INITIAL_SETTINGS: RestaurantSettings = {
  name: 'Sr. Coxita',
  tagline: 'As melhores coxinhas e delícias artesanais',
  primaryColor: '#e11d48',
  secondaryColor: '#7f1d1d',
  logoUrl: '',
  ratingIcon: 'coxinha',
  evaluationTitle: 'Como foi sua experiência hoje?',
  evaluationDescription: 'Adoramos ter você aqui! Conte para nós o que achou da sua visita e receba um mimo especial em agradecimento.',
  totalTables: 24,
  activeRewardMode: 'wheel',
  fixedRewardId: 'reward-1',
  requireName: false,
  rewardDelayHours: 24,
  rewardValidityDays: 15,
  autoSendWhatsApp: true,
  autoSendMode: 'silent_api',
  managerPin: '2325',
  whatsappApiUrl: 'https://graph.facebook.com/v20.0/1295064457026684/messages',
  whatsappApiToken: '',
  whatsappCustomMessage: '',
};

export const INITIAL_WAITERS: Waiter[] = [
  {
    id: 'waiter-1',
    name: 'Carlos Oliveira',
    nickname: 'Carlinhos',
    badgeNumber: '01',
    role: 'Garçom',
    active: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 30).toISOString(),
  },
  {
    id: 'waiter-2',
    name: 'Mariana Santos',
    nickname: 'Mari',
    badgeNumber: '04',
    role: 'Garçonete',
    active: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 25).toISOString(),
  },
  {
    id: 'waiter-3',
    name: 'Lucas Pereira',
    nickname: 'Luquinhas',
    badgeNumber: '07',
    role: 'Garçom',
    active: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 15).toISOString(),
  },
  {
    id: 'waiter-4',
    name: 'Juliana Costa',
    nickname: 'Ju',
    badgeNumber: '11',
    role: 'Atendente',
    active: true,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10).toISOString(),
  },
  {
    id: 'waiter-5',
    name: 'Marcos Souza',
    nickname: 'Marquinhos',
    badgeNumber: '15',
    role: 'Cumim',
    active: false,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 5).toISOString(),
  },
];

export const WAITER_COMPLIMENTS: string[] = [
  'Super educado(a) e simpático(a)',
  'Atendimento ágil e prestativo',
  'Excelentes sugestões de coxinhas',
  'Sempre atento à mesa',
  'Muito cortês e atencioso(a)',
  'Cuidado especial com as crianças',
];

export const INITIAL_REWARDS: RewardOption[] = [
  {
    id: 'reward-1',
    title: 'PORÇÃO DE BATATA FRITA',
    description: 'Batata frita crocante por fora e macia por dentro, servida quentinha.',
    iconName: 'UtensilsCrossed',
    category: 'appetizer',
    enabled: true,
    probabilityWeight: 45,
  },
  {
    id: 'reward-2',
    title: 'CHURROS MIX TRADICIONAL',
    description: 'Mini churros crocantes recheados, polvilhados no açúcar com canela.',
    iconName: 'Cake',
    category: 'dessert',
    enabled: true,
    probabilityWeight: 45,
  },
  {
    id: 'reward-3',
    title: '10 % DE DESCONTO',
    description: '10% de desconto no valor total da sua comanda no Sr. Coxita.',
    iconName: 'Percent',
    category: 'discount',
    enabled: true,
    probabilityWeight: 5,
  },
  {
    id: 'reward-4',
    title: '5% DE DESCONTO',
    description: '5% de desconto no valor total da sua comanda no Sr. Coxita.',
    iconName: 'Percent',
    category: 'discount',
    enabled: true,
    probabilityWeight: 5,
  },
];

export const INITIAL_REVIEWS: Review[] = [];

export const QUICK_TAGS_OPTIONS = [
  'Coxinhas sequinhas e quentes',
  'Massa crocante e leve',
  'Recheio generoso e cremoso',
  'Molhos especiais da casa',
  'Garçom super atencioso',
  'Atendimento rápido e simpático',
  'Ambiente limpo e agradável',
  'Bebidas bem geladas',
  'Demora na entrega dos pedidos',
  'Demora para fechar a conta',
  'Salão um pouco movimentado',
];
