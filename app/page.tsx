import { fetchOdoo, OdooProduct } from '@/app/services/odooService';
import HomeClient from '@/app/components/HomeClient';

// Force dynamic rendering because Odoo data changes regularly
export const dynamic = 'force-dynamic';

export default async function Home() {

  // Fetch real-time data from Odoo
  // We explicitly ask for products that are active
  let products: OdooProduct[] = [];

  try {
    products = await fetchOdoo(
      "product.template",
      "search_read",
      [[["active", "=", true]]],
      {
        fields: ["id", "name", "default_code", "list_price", "qty_available", "x_statu", "x_area", "x_mz", "x_etapa", "x_lote", "x_cliente"],
        limit: 1000
      }
    );
    console.log(`Successfully fetched ${products.length} products from Odoo.`);
    if (products.length > 0) {
      console.log("Sample Product Data:", JSON.stringify(products[0], null, 2));
    }


  } catch (error) {
    console.error("Failed to fetch initial Odoo data:", error);
    // We don't crash the whole app, just pass empty array. 
    // The client component will fallback to local data.
  }

  return (
    <main>
      <HomeClient odooProducts={products} />
    </main>
  );
}
