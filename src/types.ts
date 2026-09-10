export interface RatingCriteria {
  service: number;     // Atendimento (1 to 5)
  ambiance: number;    // Ambiente (1 to 5)
  products: number;    // Produtos / Comida e Bebida (1 to 5)
  waitTime: number;    // Tempo de Espera (1 to 5)
}

export interface Waiter {
  id: string;
  name: string;
  nickname?: string;
  badgeNumber?: string;
  role: 'Garçom' | 'Garçonete' | 'Atendente' | 'Cumim';
  photoUrl?: string;
  active: boolean;
  createdAt: string;
}

export interface Review {
  id: string;
  tableNumber?: number;
  customerName?: string;
  customerPhone?: string;
  waiterId?: string;
  waiterName?: string;
  waiterRating?: number; // 1 to 5
  waiterCompliment?: string;
  waiterCompliments?: string[];
  ratings: RatingCriteria;
  quickTags: string[];
  criticism?: string;    // Crítica
  suggestion?: string;   // Sugestão
  rewardCode: string;
  rewardTitle: string;
  rewardClaimed: boolean;
  claimedAt?: string;
  claimedTable?: number;  // Mesa onde o voucher foi validado/resgatado
  availableFrom?: string; // Data a partir da qual o brinde pode ser resgatado (24h após sorteio)
  expiresAt?: string;     // Data limite para usar o brinde (até 15 dias)
  notified5DaysAt?: string; // Data/hora em que o lembrete de 5 dias foi enviado
  notified1DayAt?: string;  // Data/hora em que o lembrete de 1 dia (amanhã) foi enviado
  whatsappStatus?: 'sent_silently' | 'delivered' | 'failed' | 'pending'; // Status do envio sem abrir app
  whatsappSentAt?: string;
  rewardSentViaWhatsapp?: boolean; // True quando o brinde foi efetivamente enviado apos cliente responder SIM
  createdAt: string;
}

export interface RewardOption {
  id: string;
  title: string;
  description: string;
  iconName: string;
  category: 'dessert' | 'drink' | 'discount' | 'appetizer';
  enabled: boolean;
  probabilityWeight?: number;
}

export type RatingIconType = 'star' | 'coxinha' | 'brigadeiro' | 'cake' | 'pizza';

export interface RestaurantSettings {
  name: string;
  tagline: string;
  primaryColor: string;
  secondaryColor?: string;
  logoUrl?: string;
  ratingIcon?: RatingIconType;
  evaluationTitle?: string;
  evaluationDescription?: string;
  totalTables: number;
  activeRewardMode: 'wheel' | 'fixed'; // Gira roleta ou ganha brinde fixo
  fixedRewardId: string;
  requireName: boolean;
  rewardDelayHours?: number;   // Carência para liberação do brinde em horas (padrão: 24h)
  rewardValidityDays?: number; // Validade máxima do brinde em dias (padrão: 15 dias)
  autoSendWhatsApp?: boolean;  // Enviar automaticamente o voucher para o WhatsApp do cliente
  autoSendMode?: 'silent_api' | 'auto_open' | 'open_app'; // 'silent_api' envia em 2º plano via API; 'auto_open' abre o zap automaticamente na tela; 'open_app' botão manual
  whatsappApiUrl?: string;     // URL do Gateway (Z-API, Evolution, Meta Cloud API)
  whatsappApiToken?: string;   // Token ou Chave da API do Gateway
  whatsappCustomMessage?: string; // Mensagem personalizada do voucher para WhatsApp (sem teste ou desconsiderar)
  whatsappTemplateName?: string; // Nome do template pré-aprovado pela Meta (avaliacao_brinde)
  whatsappTemplateLanguage?: string; // Idioma do template (ex: pt_BR, en_US)
  whatsappWebhookVerifyToken?: string; // Token de verificação do webhook da Meta
  managerPin?: string;         // Senha/PIN de 4 dígitos para proteger o Painel do Restaurante (padrão: 1234)
}
