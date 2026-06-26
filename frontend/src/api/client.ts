import axios from 'axios';

/**
 * Cliente Axios configurado para se comunicar com o backend Django.
 * 
 * Por que existe: Centraliza as requisições HTTP da aplicação, configurando
 * automaticamente o envio de credenciais (cookies de sessão) e o tratamento
 * de proteção CSRF (Cross-Site Request Forgery) exigido pelo Django.
 */
const api = axios.create({
  // Por que existe: Obtém dinamicamente o IP ou host que está acessando o frontend para direcionar as requisições de API ao backend correto.
  baseURL: `http://${window.location.hostname}:8000`,
  withCredentials: true,            // Envia cookies (sessão de login) em todas as requisições
  xsrfCookieName: 'csrftoken',      // Nome do cookie do Django para proteção CSRF
  xsrfHeaderName: 'X-CSRFToken',    // Header HTTP que o Django espera para o token CSRF
});

// Por que existe: Loga informações detalhadas sobre a requisição enviada
// para ajudar a rastrear se o IP ou porta de destino estão corretos.
api.interceptors.request.use((config) => {
  console.log(`[API Request] Enviando requisição para: ${config.baseURL}${config.url}`);
  return config;
}, (error) => {
  console.error('[API Request Error]', error);
  return Promise.reject(error);
});

// Por que existe: Monitora respostas de erro de rede e CORS, fornecendo dicas detalhadas
// no console do navegador do cliente caso ocorra uma falha de conexão.
api.interceptors.response.use((response) => {
  return response;
}, (error) => {
  console.error('[API Response Error]', {
    message: error.message,
    code: error.code,
    config: error.config,
    response: error.response
  });

  if (error.code === 'ERR_NETWORK') {
    console.error(
      '💡 DICA DE REDE/CORS:\n' +
      'Se você vir esta mensagem, a requisição ao backend falhou.\n' +
      '1. Verifique se o servidor Django no backend está rodando com: python manage.py runserver 0.0.0.0:8000\n' +
      '2. Se o backend estiver rodando, o Firewall do Windows da máquina servidora está bloqueando conexões na porta 8000.\n' +
      '3. Certifique-se de que ambas as máquinas estão conectadas na mesma rede local e o IP acessado é o correto.'
    );
  }
  return Promise.reject(error);
});

export default api;
