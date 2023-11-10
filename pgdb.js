const express = require('express');
const pgp = require('pg-promise')();
const cors = require('cors');
const wkx = require('wkx');
const turf = require('@turf/turf');

const app = express();
const port = 3001;

const db = pgp({
    user: '',
    password: '',
    host: '',
    port: 5432,
    database: '',
});

app.use(cors());

function generateRegex(searchTerm) {
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = new RegExp(`${escapedSearchTerm}`, 'i');
    
    return regexPattern;
};

function convertWkbToCoords(wkb) {
    const geometry = wkx.Geometry.parse(Buffer.from(wkb, 'hex'));
    const coordinates = geometry.toGeoJSON();
    const t = turf.centroid(coordinates);

    return t.geometry.coordinates
}

function relevantSuggestions(resData, userInput) {
    const userRegex = generateRegex(userInput)
    const matchedSuggestion = resData
        .filter((el) => userRegex.test(el.name))
        .map((el) => ({ name: el.name, geom: convertWkbToCoords(el.geom) }))

    return matchedSuggestion.slice(0, 10)
}

app.get('/api/data', async (req, res) => {
    try {
        const userInput = req.query.query; // Get the query parameter from the client
        const query = `select name, geom from buildings;`;

        const data = await db.any(query);

        const suggestions = relevantSuggestions(data, userInput);

        res.json(suggestions);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred.' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
