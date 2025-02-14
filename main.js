require("dotenv").config();
const { ethers } = require("ethers");
const readline = require("readline-sync");
const fs = require("fs");

if (!process.env.RPC_URL || !process.env.PRIVATE_KEY) {
    console.error("\x1b[31m❌ ERROR: Pastikan file .env berisi RPC_URL dan PRIVATE_KEY\x1b[0m");
    process.exit(1);
}

const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const abi = JSON.parse(fs.readFileSync("Token_abi.json", "utf8"));
const bytecode = fs.readFileSync("Token_bytecode.txt", "utf8").trim();

const usedTokens = new Set();

// Fungsi untuk membuat nama & simbol token unik
function generateUniqueToken() {
    const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const randomChars = () => Array.from({ length: 5 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");

    let token;
    do {
        token = { name: `Token ${randomChars()}`, symbol: randomChars() };
    } while (usedTokens.has(`${token.name}|${token.symbol}`));

    usedTokens.add(`${token.name}|${token.symbol}`);
    return token;
}

// Fungsi untuk menampilkan garis
function printLine() {
    console.log("\x1b[32m" + "═".repeat(50) + "\x1b[0m");
}

// Fungsi untuk menyimpan hasil ke dalam file logs.txt
function saveLog(message) {
    const timestamp = new Date().toISOString();
    fs.appendFileSync("logs.txt", `[${timestamp}] ${message}\n`);
}

// Fungsi untuk animasi loading
async function loadingAnimation(message, duration) {
    const symbols = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
    const interval = 150;
    let i = 0;

    process.stdout.write(`\x1b[36m${message}...\x1b[0m`);

    const timer = setInterval(() => {
        process.stdout.write(`\r\x1b[36m${message} ${symbols[i]}\x1b[0m`);
        i = (i + 1) % symbols.length;
    }, interval);

    await new Promise((resolve) => setTimeout(resolve, duration));
    clearInterval(timer);
    process.stdout.write(`\r\x1b[32m✔ ${message} selesai!\x1b[0m\n`);
    saveLog(`${message} selesai!`);
}

// Menampilkan menu
console.clear();
console.log("🚀 Welcome to Token Deployer");
printLine();
const tokenCount = parseInt(readline.question("🔢 Berapa banyak token yang akan dideploy? "), 10);

let manualGasPrice;
while (true) {
    manualGasPrice = readline.question("⛽ Masukkan Gas Price (dalam Gwei): ");
    if (!isNaN(manualGasPrice) && Number(manualGasPrice) > 0) {
        break;
    }
    console.log("\x1b[31m❌ ERROR: Masukkan angka yang valid untuk Gas Price!\x1b[0m");
}
const gasPrice = ethers.parseUnits(manualGasPrice, "gwei");

// Fungsi deploy smart contract
async function deployContract(name, symbol, supply) {
    console.clear();
    const startTime = Date.now();
    console.log(`\x1b[36m🚀 Deploying:\x1b[0m \x1b[33m${name} (${symbol})\x1b[0m`);
    printLine();

    const factory = new ethers.ContractFactory(abi, bytecode, wallet);

    try {
        let estimatedGas;
        try {
            estimatedGas = await factory.signer.estimateGas(factory.getDeployTransaction(name, symbol, ethers.parseUnits(supply, 18)));
        } catch (err) {
            console.log("\n\x1b[33m⚠️ WARNING: Estimasi gas gagal, menggunakan nilai default.\x1b[0m\n");
            estimatedGas = BigInt("500000");
        }

        const options = { gasPrice, gasLimit: estimatedGas * BigInt(2) };

        console.log(`👤 \x1b[36mDeployer:\x1b[0m ${wallet.address}`);
        console.log(`⛽ \x1b[36mGas Price:\x1b[0m ${manualGasPrice} Gwei`);
        console.log(`🔢 \x1b[36mSupply:\x1b[0m ${supply} Tokens`);
        printLine();

        const contract = await factory.deploy(name, symbol, ethers.parseUnits(supply, 18), options);
        const tx = contract.deploymentTransaction();

        if (tx) {
            await loadingAnimation("Menunggu konfirmasi transaksi", 7000);

            // Adding a timeout to avoid waiting forever
            const timeout = 18000; // 3 minutes timeout (in ms)
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Timeout: Transaction confirmation took too long')), timeout)
            );
            
            const receiptPromise = tx.wait();
            
            // Wait for either the receipt or the timeout
            const receipt = await Promise.race([receiptPromise, timeoutPromise]);

            const contractAddress = await contract.getAddress();
            const blockhash = (await provider.getBlock(receipt.blockNumber)).hash;

            console.log("\x1b[32m✅ SUCCESS:\x1b[0m", `${name} (${symbol})`);
            console.log(`📜 \x1b[36mContract:\x1b[0m ${contractAddress}`);
            console.log(`🔗 \x1b[36mTX Hash:\x1b[0m ${tx.hash}`);
            console.log(`🔲 \x1b[36mBlockhash:\x1b[0m ${blockhash}`);
            console.log(`⏱️ \x1b[36mDuration:\x1b[36m ${(Date.now() - startTime) / 1000}s`);
            printLine();

            saveLog(`✅ ${name} (${symbol}) deployed successfully!\nContract: ${contractAddress}\nTX Hash: ${tx.hash}\nBlockhash: ${blockhash}\nDuration: ${(Date.now() - startTime) / 1000}s`);
        } else {
            throw new Error("Gagal mendapatkan transaksi untuk contract deployment");
        }

    } catch (error) {
        console.log("\x1b[31m❌ ERROR: Gagal mendeply contract!\x1b[0m");

        // Simpan pesan error yang lebih rinci ke dalam file logs.txt
        saveLog(`❌ ERROR: Gagal mendeply ${name} (${symbol}) - ${error.message}`);
    }
}

// Fungsi utama untuk deploy satu per satu
async function main() {
    console.clear();
    console.log("👤 Deployer Address:", wallet.address);
    printLine();
    saveLog(`Deployer Address: ${wallet.address}`);

    for (let i = 0; i < tokenCount; i++) {
        console.log(`🚀 Deploying token ${i + 1} of ${tokenCount}`);
        printLine();

        const { name, symbol } = generateUniqueToken();
        const supply = (Math.floor(Math.random() * 9000000) + 1000000).toString();
        
        await deployContract(name, symbol, supply);

        // Tunggu sebentar sebelum melanjutkan ke deploy berikutnya
        const delay = (ms) => new Promise(res => setTimeout(res, ms));
        await delay(5000); // Tunggu 5 detik
    }

    console.log("\x1b[36m📂 Hasil deploy telah disimpan di logs.txt\x1b[0m");
    saveLog("Deploy process finished. Results saved in logs.txt");
}

main().catch(console.error);
