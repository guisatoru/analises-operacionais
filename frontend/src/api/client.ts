import axios from 'axios';

/**
 * Cliente Axios configurado para se comunicar com o backend Django.
 * 
 * Por que existe: Centraliza as requisições HTTP da aplicação, configurando
 * automaticamente o envio de credenciais (cookies de sessão) e o tratamento
 * de proteção CSRF (Cross-Site Request Forgery) exigido pelo Django.
 */
const api = axios.create({
  baseURL: 'http://localhost:8000', // URL padrão do servidor Django local
  withCredentials: true,            // Envia cookies (sessão de login) em todas as requisições
  xsrfCookieName: 'csrftoken',      // Nome do cookie do Django para proteção CSRF
  xsrfHeaderName: 'X-CSRFToken',    // Header HTTP que o Django espera para o token CSRF
});

export default api;
