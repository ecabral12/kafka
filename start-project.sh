#!/bin/bash

# Clone le repository
git clone https://github.com/ecabral12/kafka.git

# Accède au répertoire cloné
cd kafka

# Lance les conteneurs Docker en arrière-plan
docker-compose up -d

# Installe les dépendances Node.js
npm install

# Lance l'application en mode production
npm run start:prod
