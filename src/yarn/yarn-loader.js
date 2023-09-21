import {
	openDB,
	deleteDB,
	wrap,
	unwrap,
} from "idb";

const IDB_DB_YARN = "yarn-cache";
const IDB_STORE_CACHE = "cache";
const IDB_STORE_LOCK = "lockfile";
const IDB_CACHE_VERSION = 1;

async function getDB() {
	return openDB(IDB_DB_YARN, IDB_CACHE_VERSION, {
		upgrade(db, oldVersion, newVersion, transaction) {
			db.createObjectStore(IDB_STORE_CACHE, {
				keyPath: "name",
			});
			db.createObjectStore(IDB_STORE_LOCK, {
				keyPath: "name",
			});
		},
		blocked() {},
		blocking() {},
		terminated() {},
	});
}

const memfs = window.yarnLoader.memfs

const YARN_CACHE_DIR = "/.yarn-global/cache";
const YARN_LOCKFILE = "/app/yarn.lock";
const Cache = {
	async saveCache() {
		const files = memfs
			.readdirSync(YARN_CACHE_DIR)
			.map((name) => [
				name,
				memfs.readFileSync(YARN_CACHE_DIR + "/" + name),
			]);

		const db = await getDB();
		const tx = db.transaction(IDB_STORE_CACHE, "readwrite");
		await Promise.all([
			...files.map(([name, data]) =>
				tx.store.put({
					name,
					data,
				})
			),
			tx.done,
		]);
	},
	async restoreCache() {
		memfs.mkdirpSync(YARN_CACHE_DIR);
		const db = await getDB();
		for (let { name, data } of await db.getAll(IDB_STORE_CACHE)) {
			memfs.writeFileSync(YARN_CACHE_DIR + "/" + name, data);
		}
	},

	async saveLockfile() {
		const data = memfs.readFileSync(YARN_LOCKFILE);

		const db = await getDB();
		const tx = db.transaction(IDB_STORE_LOCK, "readwrite");
		const result = await db.put(IDB_STORE_LOCK, {
			name: "yarn.lock",
			data,
		});
	},
	async restoreLockfile() {
		const db = await getDB();
		const result = await db.get(IDB_STORE_LOCK, "yarn.lock");
		if (result) {
			memfs.writeFileSync(YARN_LOCKFILE, result.data);
		}
	},
};

export const yarnContext = {
	memfs
}

export const yarnLoader = (plugin) => {
    (async () => {
        if (!await plugin.call('fileManager', 'exists', './package.json')) {
            console.log('no package.json found')
            return
        }
        let packageJSON = await plugin.call('fileManager', 'readFile', './package.json');
        // packageJSON = JSON.parse(packageJSON)

		console.log('resolving', packageJSON)
        memfs.mkdirSync("/tmp");
        memfs.mkdirSync("/app");
        memfs.writeFileSync(
            "/app/package.json",
            packageJSON
        );
    
        const dir = "/app";
    
        console.log("Restoring cache...");
        await Cache.restoreLockfile();
        await Cache.restoreCache();
        console.log("Starting Yarn...");
        console.time("Finished in");

		memfs.orgWriteFileSync = memfs.writeFileSync
		memfs.orgWriteFile = memfs.writeFile

		const textDecoder = new TextDecoder()
		memfs.writeFileSync = (name, content) => {
			memfs.orgWriteFileSync(name, content)
			// plugin.call('fileManager', 'writeFile', name.replace('/app/', './'), typeof content === 'string' ? content : textDecoder.decode(content))		
		}

		memfs.writeFile = (name, content, cb) => {
			memfs.orgWriteFile(name, content, cb)
			// plugin.call('fileManager', 'writeFile', name.replace('/app/', './'), typeof content === 'string' ? content : textDecoder.decode(content))		
		}
        let { report } = await window.yarnLoader.run({
            dir,
            fs: memfs,
            options: {
                enableGlobalCache: true,
                globalFolder: "/.yarn-global",
            },
            progress: function ({ type, indent, data, displayName } ) {
               plugin.call('terminal', 'log', `${displayName}  ${data}`)
                /*console.log(
                    `%c[${displayName}] ${indent} ${data}`,
                    `font-family: monospace;${
                        type === "error" ? "color: red;" : ""
                    }`
                );*/
            },
        });
        console.timeEnd("Finished in");
    
        if (report.reportedErrors.size > 0) {
			console.log(report.reportedErrors)
			// throw [...report.reportedErrors][0];
		}
    
        console.log("node_modules:", memfs.readdirSync("/app/node_modules"));
    
        await Cache.saveLockfile();
        await Cache.saveCache();
		/*
		memfs
			.readdirSync(YARN_CACHE_DIR)
			.map((name) => {
				plugin.call('fileManager', 'writeFile', name, memfs.readFileSync(YARN_CACHE_DIR + "/" + name))
			});
		*/
    })().catch((e) => {
        console.error(e.message);
    });
    
}
