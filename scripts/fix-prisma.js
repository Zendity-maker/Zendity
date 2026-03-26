const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
    fs.readdirSync(dir).forEach(f => {
        let dirPath = path.join(dir, f);
        if (fs.statSync(dirPath).isDirectory()) {
            walkDir(dirPath, callback);
        } else if (f.endsWith('.ts') || f.endsWith('.tsx')) {
            callback(dirPath);
        }
    });
}

let count = 0;
walkDir(path.join(__dirname, '../src'), (filePath) => {
    if (filePath.includes('lib/prisma.ts')) return;
    
    let content = fs.readFileSync(filePath, 'utf-8');
    let original = content;
    
    // Check if file instantiates PrismaClient
    if (/const\s+prisma\s*=\s*new\s+PrismaClient\(\s*\)\s*;/.test(content)) {
        // 1. Remove instantiation
        content = content.replace(/const\s+prisma\s*=\s*new\s+PrismaClient\(\s*\)\s*;/g, '');
        
        // 2. Add or replace import
        const exactImportRegex = /import\s+\{\s*PrismaClient\s*\}\s+from\s+['"]@prisma\/client['"]\s*;/g;
        
        if (exactImportRegex.test(content)) {
            content = content.replace(exactImportRegex, "import { prisma } from '@/lib/prisma';");
        } else {
            // Need to append our import since they might have destructured other things
            content = "import { prisma } from '@/lib/prisma';\n" + content;
            // Best effort to remove PrismaClient from destructuring if it's there
            content = content.replace(/,\s*PrismaClient\b|\bPrismaClient\s*,/g, '');
        }
        
        if (original !== content) {
            fs.writeFileSync(filePath, content, 'utf-8');
            count++;
        }
    }
});

console.log(`Fix aplicado a ${count} archivos.`);
