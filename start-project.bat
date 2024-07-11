@echo off

REM Clone le repository
git clone https://github.com/ecabral12/kafka.git

REM Accède au répertoire cloné
cd kafka

REM Lance les conteneurs Docker en arrière-plan
docker-compose up -d

REM Installe les dépendances Node.js
npm install

REM Lance l'application en mode production
npm run start:prod
