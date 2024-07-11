

# Projet Kafka

Ce projet est destiné à démontrer l'utilisation de Kafka avec Docker et Node.js.

## Prérequis

Avant de commencer, assurez-vous d'avoir installé les outils suivants sur votre machine :

- **Git**: Pour cloner le repository.
- **Docker**: Pour exécuter les conteneurs nécessaires à Kafka.
- **Node.js et npm**: Pour installer les dépendances et exécuter l'application Node.js.

## Installation

1. Clonez ce repository en utilisant la commande suivante :
   ```
   git clone https://github.com/ecabral12/kafka.git
   ```

2. Accédez au répertoire cloné :
   ```
   cd kafka
   ```

3. Utilisez Docker Compose pour démarrer les conteneurs Kafka en arrière-plan :
   ```
   docker-compose up -d
   ```

4. Installez les dépendances Node.js nécessaires pour l'application :
   ```
   npm install
   ```
## Lancement de l'application manuel

Après avoir installé les dépendances, lancez l'application en mode production en utilisant la commande suivante :
   ```
   npm run start:prod
   ```

Cette commande va démarrer votre application Node.js qui utilise Kafka en mode production. Assurez-vous que les conteneurs Docker pour Kafka sont en cours d'exécution avant de lancer cette commande.


## Lancement de l'application Auto

### À l'aide du script (Linux / macOS)

Pour lancer toutes les étapes nécessaires en une seule commande sur Linux ou macOS, vous pouvez utiliser le script suivant :

```bash
./start-project.sh
```

Ce script va automatiquement cloner le repository, démarrer les conteneurs Docker, installer les dépendances Node.js, et lancer l'application en mode production.

### À l'aide du script (Windows)

Pour lancer toutes les étapes nécessaires en une seule commande sur Windows, vous pouvez utiliser le script suivant :

```batch
start-project.bat
```

Ce script va automatiquement cloner le repository, démarrer les conteneurs Docker, installer les dépendances Node.js, et lancer l'application en mode production.

L'application devrait maintenant être accessible à l'adresse spécifiée dans votre configuration.

## Arrêt de l'application

Pour arrêter les conteneurs Docker utilisés par Kafka, utilisez la commande suivante depuis le répertoire du projet :
   ```
   docker-compose down
   ```

## Remarques supplémentaires

- Assurez-vous que les ports nécessaires pour Kafka et votre application Node.js ne sont pas déjà utilisés par d'autres services sur votre machine.
- Pour toute question ou problème rencontré, n'hésitez pas à ouvrir une issue dans ce repository.

