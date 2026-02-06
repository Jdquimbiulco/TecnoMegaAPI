# TecnoMega API Redis
# JUAN DIEGO QUIMBIULCO

## Objetivo
API REST con Node.js + Express + Redis para catálogos y transacciones.

## Requisitos
- Node.js 18+
- Redis en ejecución (puerto 6379 por defecto)

## Pasos (guía rápida)
1. Instalar dependencias:
   - `npm install`
2. Levantar Redis:
   - Asegúrate de tener Redis activo en localhost:6379
3. Iniciar la API:
   - `npm start`
4. Cargar datos masivos:
   - `POST /seed`

## Endpoints
### Seed
- `POST /seed`
  - Lee data/tecnomega.json
  - Inserta en Redis con clave `coleccion:id`
  - Guarda índice en `index:coleccion`

### Guardar 1 registro (SET)
- `POST /:collection`
  - `collection`: clientes | productos | pedidos | detalle_pedido

### Obtener 1 registro (GET)
- `GET /:collection/:id`

### Listar todos
- `GET /:collection`

## Modelo de datos (campos obligatorios)
- clientes: dni, nombres, email, telefono, edad, genero
- productos: codigo, nombre, categoria, precio, stock
- pedidos: codigo, clienteId, fecha, subtotal, iva, total, estado
- detalle_pedido: codigo, productoId, cantidad, detalle, precioUnit

