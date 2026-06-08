# Esta imagem foi escolhida porque o Node.js é necessário para executar o Vite e o React.
FROM node:22-slim

# Definimos o diretório de trabalho para organizar os arquivos do frontend no container.
WORKDIR /app

# Copiamos o package.json e o package-lock.json primeiro para que o Docker possa fazer cache dos pacotes instalados, agilizando builds futuros.
COPY package*.json ./

# Instala as dependências declaradas no package.json.
RUN npm install

# Copia os demais arquivos do projeto frontend para dentro do container.
COPY . .

# Expõe a porta 5173 para que ela possa ser acessada fora do container.
EXPOSE 5173

# O comando npm run dev inicializa o servidor de desenvolvimento do Vite.
# O parâmetro '--host' é necessário para que o Vite escute em todas as interfaces de rede do container,
# permitindo que você o acesse do seu navegador no Windows/WSL.
CMD ["npm", "run", "dev", "--", "--host"]
