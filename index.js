import express from 'express';
import { createClient } from 'redis';
import responseTime from 'response-time';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const PORT = 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

//Configuracion de REDIS
const client = createClient();

client.on('error', err => console.log('Redis Client Error', err));

await client.connect();

app.use(express.json());
app.use(responseTime());

const COLLECTIONS = ['clientes', 'productos', 'pedidos', 'detalle_pedido'];
const ID_FIELDS = {
  clientes: 'dni',
  productos: 'codigo',
  pedidos: 'codigo',
  detalle_pedido: 'codigo'
};

const REQUIRED_FIELDS = {
  clientes: ['dni', 'nombres', 'email', 'telefono', 'edad', 'genero'],
  productos: ['codigo', 'nombre', 'categoria', 'precio', 'stock'],
  pedidos: ['codigo', 'clienteId', 'fecha', 'subtotal', 'iva', 'total', 'estado'],
  detalle_pedido: ['codigo', 'productoId', 'cantidad', 'detalle', 'precioUnit']
};

const getKey = (collection, id) => `${collection}:${id}`;
const getIndexKey = collection => `index:${collection}`;

const validateCollection = collection => COLLECTIONS.includes(collection);

const validatePayload = (collection, payload) => {
  const required = REQUIRED_FIELDS[collection];
  const missing = required.filter(field => payload[field] === undefined || payload[field] === null);
  return missing;
};

// 1) Carga masiva desde JSON (SET)
app.post('/seed', async (req, res) => {
  try {
    const dataPath = path.join(__dirname, 'data', 'tecnomega.json');
    const file = await fs.readFile(dataPath, 'utf-8');
    const data = JSON.parse(file);

    let inserted = 0;

    for (const collection of COLLECTIONS) {
      const items = Array.isArray(data[collection]) ? data[collection] : [];
      for (const item of items) {
        const missing = validatePayload(collection, item);
        if (missing.length > 0) {
          continue;
        }
        const id = item[ID_FIELDS[collection]];
        const key = getKey(collection, id);
        await client.set(key, JSON.stringify(item));
        await client.sAdd(getIndexKey(collection), key);
        inserted += 1;
      }
    }

    res.json({ inserted });
  } catch (err) {
    res.status(500).json({ error: `Error en seed: ${err.message}` });
  }
});

// 2) Guardar 1 registro (SET)
app.post('/:collection', async (req, res) => {
  const { collection } = req.params;
  const payload = req.body;

  if (!validateCollection(collection)) {
    return res.status(400).json({ error: 'Colección no válida' });
  }

  const missing = validatePayload(collection, payload);
  if (missing.length > 0) {
    return res.status(400).json({ error: 'Faltan campos', missing });
  }

  try {
    const id = payload[ID_FIELDS[collection]];
    const key = getKey(collection, id);
    await client.set(key, JSON.stringify(payload));
    await client.sAdd(getIndexKey(collection), key);
    res.status(201).json({ key, saved: true });
  } catch (err) {
    res.status(500).json({ error: `Error al guardar: ${err.message}` });
  }
});

// 3) Obtener 1 registro (GET)
app.get('/:collection/:id', async (req, res) => {
  const { collection, id } = req.params;

  if (!validateCollection(collection)) {
    return res.status(400).json({ error: 'Colección no válida' });
  }

  try {
    const key = getKey(collection, id);
    const value = await client.get(key);
    if (!value) {
      return res.status(404).json({ error: 'Registro no encontrado' });
    }
    res.json({ key, data: JSON.parse(value) });
  } catch (err) {
    res.status(500).json({ error: `Error al obtener: ${err.message}` });
  }
});

// 4) Listar todos los registros de una tabla
app.get('/:collection', async (req, res) => {
  const { collection } = req.params;

  if (!validateCollection(collection)) {
    return res.status(400).json({ error: 'Colección no válida' });
  }

  try {
    const keys = await client.sMembers(getIndexKey(collection));
    if (keys.length === 0) {
      return res.json({ count: 0, data: [] });
    }
    const values = await client.mGet(keys);
    const data = values.filter(Boolean).map(value => JSON.parse(value));
    res.json({ count: data.length, data });
  } catch (err) {
    res.status(500).json({ error: `Error al listar: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});