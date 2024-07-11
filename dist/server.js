var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { KafkaClient, Producer } from 'kafka-node';
import axios from 'axios';
import { ConsumerGroup } from 'kafka-node';
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
};
const client = new KafkaClient({ kafkaHost });
client.createTopics([kafkaTopic], (error, result) => {
    if (error) {
        console.error('Error creating Kafka topic:', error);
    }
    else {
        setInterval(() => {
            Object.keys(producers).forEach(city => produceWeatherData(city));
        }, 5000);
    }
});
let producers = {};
let producerPromises = {};
const fetchWeatherData = (city) => __awaiter(void 0, void 0, void 0, function* () {
    const cityCapitalized = city[0].toUpperCase() + city.slice(1);
    const apiKey = process.env.WEATHER_API_KEY;
    const apiUrl = `https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${cityCapitalized}`;
    try {
        const response = yield axios.get(apiUrl);
        return response.data;
    }
    catch (error) {
        return null;
    }
});
const createProducer = (city) => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield fetchWeatherData(city);
    if (!data) {
        return;
    }
    const client = new KafkaClient({ kafkaHost });
    const producer = new Producer(client, {
        requireAcks: 1,
        partitionerType: 1,
    });
    yield new Promise((resolve, reject) => {
        producer.on('ready', () => {
            producers[data.location.name] = producer;
            resolve();
        });
        producer.on('error', function (err) {
            reject(err);
        });
    });
});
const closeProducer = (city) => {
    if (producers[city]) {
        producers[city].close(() => {
        });
        delete producers[city];
    }
};
const produceWeatherData = (city) => __awaiter(void 0, void 0, void 0, function* () {
    if (!producers[city] && !producerPromises[city]) {
        producerPromises[city] = createProducer(city);
    }
    yield producerPromises[city];
    const weatherData = yield fetchWeatherData(city);
    if (weatherData) {
        const cityName = weatherData.location.name;
        if (city !== cityName) {
            producers[cityName] = producers[city];
            delete producers[city];
        }
        if (producers[cityName]) {
            const payloads = [
                {
                    topic: kafkaTopic.topic,
                    messages: JSON.stringify(weatherData)
                },
            ];
            producers[cityName].send(payloads, (err, data) => {
                if (err) {
                    console.error(`Error producing to Kafka for ${city}:`, err);
                }
                else {
                    console.log(`Message sent for ${city}:`, data);
                }
            });
            try {
                yield prisma.weather.create({
                    data: {
                        city: cityName,
                        temperatureC: weatherData.current.temp_c,
                        temperatureF: weatherData.current.temp_f,
                        humidity: weatherData.current.humidity,
                        windSpeed: weatherData.current.wind_kph,
                        windDirection: weatherData.current.wind_dir,
                    }
                });
            }
            catch (error) {
                console.error('Error saving data to database:', error);
            }
        }
    }
});
setInterval(() => {
    console.log('Cities:', Object.keys(producers));
    Object.keys(producers).forEach(city => produceWeatherData(city));
}, 5000);
const consumerGroupOptions = {
    kafkaHost,
    groupId: 'weather-consumer-group',
    autoCommit: true,
    fromOffset: 'latest',
    encoding: 'utf8',
};
const consumerGroup = new ConsumerGroup(consumerGroupOptions, [kafkaTopic.topic]);
const wss = new WebSocketServer({ port: 5500 });
wss.on('connection', (ws) => {
    ws.on('message', (message) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const data = JSON.parse(message.toString());
            if (data.city && !producers[data.city]) {
                yield createProducer(data.city);
            }
            else if (data.city && data.remove && producers[data.city]) {
                closeProducer(data.city);
            }
        }
        catch (error) {
            console.error('Error parsing message:', error);
        }
    }));
});
consumerGroup.on('message', function (message) {
    try {
        const weatherData = JSON.parse(message.value.toString());
        wss.clients.forEach(function each(client) {
            if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify(weatherData));
            }
        });
    }
    catch (error) {
        console.error('Error parsing message:', error);
    }
});
consumerGroup.on('error', function (error) {
    console.error('Errror in Kafka consumer group:', error);
});
const app = express();
const server = http.createServer(app);
app.use(express.static(__dirname + '/public'));
app.get('/average-weather/:city', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const city = req.params.city;
    const sevenDaysAgo = subDays(new Date(), 7);
    try {
        const averageData = yield prisma.weather.aggregate({
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
    }
    catch (error) {
        console.error('Error fetching average weather data:', error);
        res.status(500).send('Error fetching average weather data');
    }
}));
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/public/index.html');
});
server.on('upgrade', function (request, socket, head) {
    wss.handleUpgrade(request, socket, head, function (ws) {
        wss.emit('connection', ws, request);
    });
});
server.listen(80, function () {
    console.log('Server is running at http://localhost:80');
});
process.on('SIGINT', function () {
    consumerGroup.close(true, function () {
        Object.keys(producers).forEach(city => closeProducer(city));
        process.exit();
    });
});
