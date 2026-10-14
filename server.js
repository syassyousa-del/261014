const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const rootDir = __dirname;
const saveDir = path.join(rootDir, 'save');
const preferredPort = Number(process.env.PORT || 8000);

const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav'
};

fs.mkdirSync(saveDir, { recursive: true });

function send(res, status, body, type = 'application/json; charset=utf-8') {
    res.writeHead(status, { 'Content-Type': type });
    res.end(body);
}

function sendJson(res, status, data) {
    send(res, status, JSON.stringify(data), 'application/json; charset=utf-8');
}

function readRequestBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => {
            body += chunk;
            if (body.length > 5 * 1024 * 1024) {
                reject(new Error('Request body is too large.'));
                req.destroy();
            }
        });
        req.on('end', () => resolve(body));
        req.on('error', reject);
    });
}

function makeSaveFilename() {
    const stamp = new Date().toISOString()
        .replace(/[:.]/g, '-')
        .replace('T', '_')
        .replace('Z', '');
    return `save_${stamp}.json`;
}

function sanitizeSaveFilename(filename) {
    const decoded = decodeURIComponent(filename);
    if (!/^[\w.-]+\.json$/i.test(decoded)) return null;
    return decoded;
}

function serveStatic(req, res, pathname) {
    const requestedPath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.normalize(path.join(rootDir, requestedPath));

    if (!filePath.startsWith(rootDir)) {
        send(res, 403, 'Forbidden', 'text/plain; charset=utf-8');
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            send(res, 404, 'Not found', 'text/plain; charset=utf-8');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        send(res, 200, data, contentTypes[ext] || 'application/octet-stream');
    });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`);

    try {
        if (req.method === 'GET' && url.pathname === '/api/saves') {
            const files = fs.readdirSync(saveDir)
                .filter(file => file.endsWith('.json'))
                .map(file => {
                    const fullPath = path.join(saveDir, file);
                    const stat = fs.statSync(fullPath);
                    return {
                        filename: file,
                        savedAt: stat.mtime.toISOString(),
                        size: stat.size
                    };
                })
                .sort((a, b) => b.savedAt.localeCompare(a.savedAt));
            sendJson(res, 200, files);
            return;
        }

        // Handle map list request
        if (req.method === 'GET' && url.pathname === '/api/maplist') {
            console.log('Received /api/maplist request');
            let files = [];
            try {
                files = fs.readdirSync(path.join(rootDir, 'maps')).filter(f => f.endsWith('.json'));
            } catch (e) {
                console.error('Error reading maps directory', e);
            }
            console.log('Map files found:', files);
            sendJson(res, 200, files);
            return;
        }

        if (req.method === 'GET' && url.pathname.startsWith('/api/saves/')) {
            const filename = sanitizeSaveFilename(url.pathname.slice('/api/saves/'.length));
            if (!filename) {
                sendJson(res, 400, { error: 'Invalid save filename.' });
                return;
            }

            const filePath = path.join(saveDir, filename);
            if (!filePath.startsWith(saveDir)) {
                sendJson(res, 403, { error: 'Forbidden.' });
                return;
            }

            fs.readFile(filePath, 'utf8', (err, data) => {
                if (err) {
                    sendJson(res, 404, { error: 'Save file not found.' });
                    return;
                }
                send(res, 200, data, 'application/json; charset=utf-8');
            });
            return;
        }

        if (req.method === 'POST' && url.pathname === '/api/save') {
            const rawBody = await readRequestBody(req);
            const saveData = JSON.parse(rawBody);
            const filename = makeSaveFilename();
            const filePath = path.join(saveDir, filename);

            fs.writeFileSync(filePath, JSON.stringify(saveData, null, 2), 'utf8');
            sendJson(res, 201, { filename });
            return;
        }

        // Bundle maps: read all JSON from maps/ and write bundled_maps.js
        if (req.method === 'POST' && url.pathname === '/api/bundle-maps') {
            const mapsDir = path.join(rootDir, 'maps');
            const outputFile = path.join(rootDir, 'bundled_maps.js');
            try {
                const files = fs.readdirSync(mapsDir).filter(f => f.endsWith('.json'));
                const bundledMaps = {};
                const errors = [];
                for (const file of files) {
                    try {
                        const content = fs.readFileSync(path.join(mapsDir, file), 'utf8');
                        bundledMaps[file] = JSON.parse(content);
                    } catch (e) {
                        errors.push(`${file}: ${e.message}`);
                    }
                }
                const outputContent = `window.BUNDLED_MAPS = ${JSON.stringify(bundledMaps, null, 2)};\n`;
                fs.writeFileSync(outputFile, outputContent, 'utf8');
                sendJson(res, 200, {
                    success: true,
                    count: Object.keys(bundledMaps).length,
                    files: Object.keys(bundledMaps),
                    errors: errors.length > 0 ? errors : undefined
                });
            } catch (e) {
                sendJson(res, 500, { error: e.message });
            }
            return;
        }

        // Serve static files for all other routes
        serveStatic(req, res, url.pathname);
        return;
    } catch (err) {
        sendJson(res, 500, { error: err.message });
    }
});

function listen(port, attemptsLeft = 10) {
    const onError = err => {
        if (err.code === 'EADDRINUSE' && attemptsLeft > 0) {
            server.removeListener('listening', onListening);
            listen(port + 1, attemptsLeft - 1);
            return;
        }
        throw err;
    };

    const onListening = () => {
        server.removeListener('error', onError);
        console.log(`Famicom Wars Clone server running at http://localhost:${port}`);
        console.log(`Save files will be written to: ${saveDir}`);
    };

    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(port);
}

listen(preferredPort);
