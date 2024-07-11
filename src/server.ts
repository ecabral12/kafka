import { KafkaClient, Producer, ProduceRequest } from 'kafka-node';
import axios from 'axios';
import { ConsumerGroup, ConsumerGroupOptions } from 'kafka-node';
import { WebSocketServer, WebSocket } from 'ws';
import express from 'express';
import http from 'http';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { PrismaClient } from '@prisma/client';
import { subDays } from 'date-fns';
const prisma = new PrismaClient();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const kafkaHost = 'localhost:9092';
const kafkaTopic = {
    topic: 'weather-data',
    partitions: 10,
    replicationFactor: 1
}

const client = new KafkaClient({ kafkaHost });

client.createTopics([kafkaTopic], (error, result) => {
    if (error) {
        console.error('Error creating Kafka topic:', error);
    } else {
        console.log('Kafka topic created:', result);
        // Start producing weather data after topic creation
        setInterval(() => {
            console.log('Cities:', Object.keys(producers));
            Object.keys(producers).forEach(city => produceWeatherData(city));
        }, 5000);
    }
});


let producers: { [key: string]: Producer } = {}; // Object pour stocker les producteurs par ville
let producerPromises: { [key: string]: Promise<void> } = {}; // Object pour stocker les promesses de création de producteur par ville

const fetchWeatherData = async (city: string): Promise<any> => {
    const cityCapitalized = city[0].toUpperCase() + city.slice(1);
    const apiKey = process.env.WEATHER_API_KEY;
    const apiUrl = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${cityCapitalized}`;

    try {
        const response = await axios.get(apiUrl);
        return response.data;
    } catch (error) {
        console.error(`Error fetching weather data for ${city}:`, error.message);
        return null;
    }
}

const createProducer = async (city: string): Promise<void> => {
    const data = await fetchWeatherData(city);
    if (!data) {
        return;
    }
    const client = new KafkaClient({ kafkaHost });

    const producer = new Producer(client, {
        requireAcks: 1,
        partitionerType: 1, // Random partitioner
    });

    await new Promise<void>((resolve, reject) => {
        producer.on('ready', () => {
            producers[data.location.name] = producer;
            console.log(`Producer for ${city} created`);
            resolve();
        });

        producer.on('error', function (err) {
            console.error(`Error producing to Kafka for ${city}:`, err);
            reject(err);
        });
    });
}

const closeProducer = (city: string) => {
    if (producers[city]) {
        producers[city].close(() => {
            console.log(`Producer for ${city} closed`);
        });
        delete producers[city];
    }
}

const produceWeatherData = async (city: string) => {
    if (!producers[city] && !producerPromises[city]) {
        producerPromises[city] = createProducer(city);
    }

    await producerPromises[city];

    const weatherData = await fetchWeatherData(city);

    if (weatherData) {
        const cityName = weatherData.location.name;

        if (city !== cityName) {
            producers[cityName] = producers[city];
            delete producers[city];
        }

        if (producers[cityName]) {
            const payloads: ProduceRequest[] = [
                {
                    topic: kafkaTopic.topic,
                    messages: JSON.stringify(weatherData)
                },
            ];

            producers[cityName].send(payloads, (err, data) => {
                if (err) {
                    console.error(`Error producing to Kafka for ${city}:`, err);
                } else {
                    console.log(`Message sent for ${city}:`, data);
                }
            });

            // Sauvegarde des données dans la base de données
            try {
                await prisma.weather.create({
                    data: {
                        city: cityName,
                        temperatureC: weatherData.current.temp_c,
                        temperatureF: weatherData.current.temp_f,
                        humidity: weatherData.current.humidity,
                        windSpeed: weatherData.current.wind_kph,
                        windDirection: weatherData.current.wind_dir,
                    }
                });
            } catch (error) {
                console.error('Error saving data to database:', error);
            }
        }
    }
}

setInterval(() => {
    console.log('Cities:', Object.keys(producers));
    Object.keys(producers).forEach(city => produceWeatherData(city));
}, 5000);

const consumerGroupOptions: ConsumerGroupOptions = {
    kafkaHost,
    groupId: 'weather-consumer-group',
    autoCommit: true,
    fromOffset: 'latest',
    encoding: 'utf8',
};

const consumerGroup = new ConsumerGroup(consumerGroupOptions, [kafkaTopic.topic]);

const wss = new WebSocketServer({ port: 5500 });

wss.on('connection', (ws) => {
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());

            if (data.city && !producers[data.city]) {
                await createProducer(data.city);
                console.log(`City added: ${data.city}`);
            } else if (data.city && data.remove && producers[data.city]) {
                closeProducer(data.city);
                console.log(`City removed: ${data.city}`);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
});

consumerGroup.on('message', function (message) {
    try {
        const weatherData = JSON.parse(message.value.toString());

        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(weatherData));
            }
        });
    } catch (error) {
        console.error('Error parsing message:', error);
    }
});

consumerGroup.on('error', function (error) {
    console.error('Error in Kafka consumer group:', error);
});

const app = express();
const server = http.createServer(app);

app.use(express.static(__dirname + '/public'));

app.get('/average-weather/:city', async (req, res) => {
    const city = req.params.city;
    const sevenDaysAgo = subDays(new Date(), 7);

    try {
        const averageData = await prisma.weather.aggregate({
            _avg: {
                temperatureC: true,
                temperatureF: true,
                humidity: true,
                windSpeed: true
            },
            where: {
                city,
                timestamp: {
                    gte: sevenDaysAgo
                }
            }
        });

        res.json(averageData);
    } catch (error) {
        console.error('Error fetching average weather data:', error);
        res.status(500).send('Error fetching average weather data');
    }
});

app.get('/', function (req, res) {
    res.sendFile(__dirname + '/public/index.html');
});

server.on('upgrade', function (request, socket, head) {
    wss.handleUpgrade(request, socket, head, function (ws) {
        wss.emit('connection', ws, request);
    });
});

server.listen(80, function () {
    console.log('Server is running on http://localhost:80');
});

process.on('SIGINT', function () {
    consumerGroup.close(true, function () {
        Object.keys(producers).forEach(city => closeProducer(city)); // Fermer tous les producteurs avant de terminer
        process.exit();
    });
});
