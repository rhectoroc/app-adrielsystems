import express from 'express';
import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import AdmZip from 'adm-zip';
import multer from 'multer';

const router = express.Router();
const execPromise = util.promisify(exec);
const upload = multer({ dest: os.tmpdir() });

const isProd = process.env.NODE_ENV === 'production' && !process.env.DATABASE_URL?.includes('localhost') && process.platform !== 'win32';

router.get('/download', async (req, res) => {
    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const sqlFile = path.join(os.tmpdir(), `backup-${timestamp}.sql`);
        const zipFile = path.join(os.tmpdir(), `backup-${timestamp}.zip`);

        if (isProd) {
            const dbUrl = process.env.DATABASE_URL;
            await execPromise(`pg_dump "${dbUrl}" -F p -f "${sqlFile}"`);
        } else {
            // Local dev using docker
            await execPromise(`docker exec adrielssystems_db pg_dump -U postgres -d adrielssystems -F p -f /tmp/backup.sql`);
            await execPromise(`docker cp adrielssystems_db:/tmp/backup.sql "${sqlFile}"`);
        }

        const zip = new AdmZip();
        zip.addLocalFile(sqlFile);
        zip.writeZip(zipFile);

        res.download(zipFile, `backup-${timestamp}.zip`, (err) => {
            if (fs.existsSync(sqlFile)) fs.unlinkSync(sqlFile);
            if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);
        });
    } catch (error) {
        console.error('Backup error:', error);
        res.status(500).json({ error: 'Error generating backup' });
    }
});

router.post('/restore', upload.single('backup'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const zipFile = req.file.path;
        const zip = new AdmZip(zipFile);
        const zipEntries = zip.getEntries();
        
        const sqlEntry = zipEntries.find(entry => entry.entryName.endsWith('.sql'));
        if (!sqlEntry) {
            if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);
            return res.status(400).json({ error: 'No SQL file found in ZIP' });
        }

        const sqlFile = path.join(os.tmpdir(), 'restore.sql');
        zip.extractEntryTo(sqlEntry, os.tmpdir(), false, true);
        const extractedSqlPath = path.join(os.tmpdir(), sqlEntry.entryName);
        
        // Ensure consistent name
        if (extractedSqlPath !== sqlFile) {
            fs.renameSync(extractedSqlPath, sqlFile); 
        }

        if (isProd) {
            const dbUrl = process.env.DATABASE_URL;
            // Clean DB first
            await execPromise(`psql "${dbUrl}" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"`);
            // Restore
            await execPromise(`psql "${dbUrl}" -f "${sqlFile}"`);
        } else {
            // Local dev using docker
            await execPromise(`docker cp "${sqlFile}" adrielssystems_db:/tmp/restore.sql`);
            await execPromise(`docker exec adrielssystems_db psql -U postgres -d adrielssystems -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO postgres; GRANT ALL ON SCHEMA public TO public;"`);
            await execPromise(`docker exec adrielssystems_db psql -U postgres -d adrielssystems -f /tmp/restore.sql`);
        }

        if (fs.existsSync(zipFile)) fs.unlinkSync(zipFile);
        if (fs.existsSync(sqlFile)) fs.unlinkSync(sqlFile);

        res.json({ message: 'Backup restored successfully' });
    } catch (error) {
        console.error('Restore error:', error);
        res.status(500).json({ error: 'Error restoring backup' });
    }
});

export default router;
