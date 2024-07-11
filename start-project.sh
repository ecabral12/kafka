#!/bin/bash

# Lance les conteneurs Docker en arrière-plan
docker-compose up -d

# Installe les dépendances Node.js
npm install

# Lance l'application en mode production
npm run start:prod
