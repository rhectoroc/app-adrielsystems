import { google } from 'googleapis';
import http from 'http';
import { exec } from 'child_process';

import readline from 'readline';

const PORT = 8081;
const REDIRECT_URI = `http://localhost:${PORT}/oauth2callback`;

const askQuestion = (query) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise(resolve => rl.question(query, ans => {
        rl.close();
        resolve(ans);
    }));
};


// Scopes required for googleService.js
const SCOPES = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/tasks',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send'
];

const profiles = [
    { key: 'SYSTEM', email: 'adriels.systems@gmail.com', envVar: 'GOOGLE_REFRESH_TOKEN_SYSTEM' },
    { key: 'JEFE', email: 'rhectoroc@gmail.com', envVar: 'GOOGLE_REFRESH_TOKEN_JEFE' },
    { key: 'JEFA', email: 'oxaurbaneja@gmail.com', envVar: 'GOOGLE_REFRESH_TOKEN_JEFA' }
];

let oauth2Client;


// Spin up a temporary local server to capture the redirect code
const startServer = (resolve, reject) => {
    const server = http.createServer(async (req, res) => {
        try {
            if (req.url.startsWith('/oauth2callback')) {
                const qs = new URL(req.url, `http://localhost:${PORT}`).searchParams;
                const code = qs.get('code');
                
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(`
                    <html>
                        <body style="font-family: system-ui, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #0f172a; color: #f8fafc;">
                            <div style="background-color: #1e293b; padding: 2.5rem; border-radius: 1rem; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.5); text-align: center; border: 1px solid #334155;">
                                <h1 style="color: #10b981; margin-top: 0;">¡Autorización Exitosa!</h1>
                                <p style="font-size: 1.1rem; color: #cbd5e1;">Puedes cerrar esta pestaña y regresar a la terminal.</p>
                                <span style="font-size: 3rem;">🚀</span>
                            </div>
                        </body>
                    </html>
                `);
                
                server.close();
                resolve(code);
            } else {
                res.writeHead(404);
                res.end('Not found');
            }
        } catch (e) {
            res.writeHead(500);
            res.end('Error parsing request');
            server.close();
            reject(e);
        }
    });

    server.listen(PORT, (err) => {
        if (err) {
            reject(err);
        }
    });
};

const getCode = () => {
    return new Promise((resolve, reject) => {
        startServer(resolve, reject);
    });
};

const run = async () => {
    console.log("==========================================================================");
    console.log("🌟 GENERADOR DE REFRESH TOKENS DE GOOGLE - ADRIEL'S SYSTEMS 🌟");
    console.log("==========================================================================");
    
    // Interactive credential gathering to avoid hardcoding secrets
    console.log("\n🔑 Por seguridad, introduce tus credenciales de Google OAuth 2.0:");
    let clientId = process.env.GOOGLE_CLIENT_ID || await askQuestion("👉 Introduce tu Google Client ID: ");
    let clientSecret = process.env.GOOGLE_CLIENT_SECRET || await askQuestion("👉 Introduce tu Google Client Secret: ");
    
    clientId = clientId.trim();
    clientSecret = clientSecret.trim();

    if (!clientId || !clientSecret) {
        console.error("❌ Error: Client ID y Client Secret son requeridos para continuar.");
        process.exit(1);
    }

    oauth2Client = new google.auth.OAuth2(
        clientId,
        clientSecret,
        REDIRECT_URI
    );

    console.log("\nEste script te guiará interactiva y automáticamente para generar los tokens.");
    console.log("\n⚠️  REQUISITO IMPORTANTE: Antes de continuar, ve a la Consola de Google Cloud:");
    console.log("   1. Entra a tu proyecto en Google Cloud Console.");
    console.log("   2. Ve a 'API y Servicios' > 'Credenciales'.");
    console.log("   3. Edita tu ID de cliente OAuth 2.0:");
    console.log(`      - Agrega en 'URIs de redireccionamiento autorizados' la siguiente URL:`);
    console.log(`        👉  ${REDIRECT_URI}`);
    console.log("   4. Guarda los cambios.\n");
    console.log("==========================================================================");
    
    // Prompt to begin
    console.log("Presiona cualquier tecla cuando hayas configurado la URI en Google Cloud...");
    await new Promise(resolve => process.stdin.once('data', resolve));

    const results = {};


    for (const profile of profiles) {
        console.log(`\n\n--------------------------------------------------------------------------`);
        console.log(`👤 Generando Refresh Token para Perfil: [${profile.key}]`);
        console.log(`📧 Cuenta de correo: ${profile.email}`);
        console.log(`--------------------------------------------------------------------------`);
        
        // Generate consent page url
        const authorizeUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline', // crucial to get a refresh token
            scope: SCOPES,
            prompt: 'consent', // force consent screen to ensure refresh token is returned
            login_hint: profile.email // prefill their email to make it easier
        });

        console.log(`Abriendo tu navegador para iniciar sesión...`);
        console.log(`Si no se abre automáticamente, copia y pega este enlace en tu navegador:\n`);
        console.log(`🔗  ${authorizeUrl}\n`);
        
        // Try opening the browser automatically
        try {
            const startCmd = process.platform === 'win32' ? 'start' : process.platform === 'darwin' ? 'open' : 'xdg-open';
            exec(`"${startCmd}" "${authorizeUrl.replace(/&/g, '^&')}"`);
        } catch (e) {
            // Silently fail if browser couldn't be opened
        }

        console.log(`Esperando que inicies sesión en tu cuenta de Google y apruebes los accesos...`);
        
        try {
            const code = await getCode();
            console.log(`\n✓ Código de autorización recibido. Intercambiando por tokens...`);
            
            const { tokens } = await oauth2Client.getToken(code);
            
            if (tokens.refresh_token) {
                results[profile.envVar] = tokens.refresh_token;
                console.log(`\n🎉 ¡Refresh Token obtenido con éxito para ${profile.key}!`);
                console.log(`📍 Variable: ${profile.envVar}`);
                console.log(`🔑 Token: ${tokens.refresh_token}`);
            } else {
                console.error(`\n❌ ¡Advertencia! Google no devolvió un refresh_token.`);
                console.error(`Esto suele pasar si no eliminaste los accesos previos de la app en la cuenta.`);
                console.error(`Por favor ve a: https://myaccount.google.com/connections`);
                console.error(`Busca tu aplicación, elimina su acceso, y vuelve a correr este script.`);
            }
        } catch (err) {
            console.error(`\n❌ Error al obtener el token para ${profile.key}:`, err.message);
        }
    }

    console.log(`\n\n==========================================================================`);
    console.log(`📋 RESUMEN DE VARIABLES PARA TU ENTORNO DE EASYPANEL:`);
    console.log(`==========================================================================\n`);
    
    // Print all environment variables to copy-paste directly
    console.log(`PORT=3000`);
    console.log(`DATABASE_URL=postgres://postgres:8d2111cf62ce27902ff7@adrielssystems_postgres:5432/adrielssystems?sslmode=disable`);
    console.log(`AUTH_SECRET=yrG_a1gWiZZo8MvdCaxs2hCBrpaZbRAs`);
    console.log(`EVOLUTION_API_URL=http://evolution-api:8080`);
    console.log(`EVOLUTION_INSTANCE_NAME=AdrielsSystems`);
    console.log(`EVOLUTION_API_KEY=429683C4C977415CAAFCCE10F7D57E11`);
    console.log(`APP_URL=https://app.adrielssystems.com`);
    console.log(`GOOGLE_CLIENT_ID=${clientId}`);
    console.log(`GOOGLE_CLIENT_SECRET=${clientSecret}`);
    
    for (const profile of profiles) {
        const token = results[profile.envVar] || '';
        console.log(`${profile.envVar}=${token}`);
    }
    
    console.log(`\n==========================================================================`);
    console.log(`¡Copia las líneas anteriores y pégalas directamente en Easypanel! 🚀`);
    console.log(`==========================================================================\n`);
    process.exit(0);
};

run().catch(console.error);
