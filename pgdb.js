const express = require('express');
const pgp = require('pg-promise')();
const cors = require('cors');
const wkx = require('wkx');
const turf = require('turf/turf');
const elasticsearch = require('@elastic/elasticsearch');

const client = new elasticsearch.Client({ /* Elasticsearch configuration */ });

const app = express();
const port = 3001;

const db = pgp({

});

app.use(cors());

/**
 * Generates a case-insensitive regular expression pattern for a given search term.
 *
 * @param {string} searchTerm - The input search term for which the regex pattern is generated.
 * @returns {RegExp} - The generated regular expression pattern.
 */
function generateRegex(searchTerm) {
    // Escape special characters in the search term to ensure they are treated as literals in the regex pattern
    const escapedSearchTerm = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = new RegExp(`${escapedSearchTerm}`, 'i'); // Create a case-insensitive regex
    
    return regexPattern;
};

/**
 * Converts Well-Known Binary (WKB) geometry to coordinates using the wkx library and Turf.js.
 *
 * @param {string} wkb - Well-Known Binary representation of a geometry (hex-encoded).
 * @returns {number[]} - The coordinates of the centroid of the geometry.
 */
function convertWkbToCoords(wkb) {
    const geometry = wkx.Geometry.parse(Buffer.from(wkb, 'hex'));
    const coordinates = geometry.toGeoJSON();
    const centroid = turf.centroid(coordinates);

    return centroid.geometry.coordinates
}

/**
 * Filters and transforms a list of suggestions based on user input.
 *
 * @param {Array} resData - An array of suggestion data objects.
 * @param {string} userInput - The user's input used for filtering suggestions.
 * @returns {Array} - An array of relevant suggestions containing name and coordinates.
 */
function relevantSuggestions(dbData, userInput) {
    const userRegex = generateRegex(userInput)
    const matchedSuggestion = dbData
        .filter((el) => userRegex.test(el.name))
        .map((el) => ({ name: el.name, geom: convertWkbToCoords(el.geom) }))

    return matchedSuggestion.slice(0, 10)
}

app.get('/api/data', async (req, res) => {
    try {
        const userInput = req.query.query; // Get the query parameter from the client
        const query = `select name, geom from buildings where name ilike $1;`;

        // Get response from database
        const data = await db.any(query, [`${userInput}%`]);

        const suggestions = relevantSuggestions(data, userInput);

        res.json(data);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred.' });
    }
});

app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});
