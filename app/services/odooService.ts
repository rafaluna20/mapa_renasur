// --- Type Definitions ---
export interface OdooUser {
    uid: number;
    name: string;
    username: string;
    session_id: string;
    partner_id: number;
    company_id: number;
    is_system: boolean;
}

export interface OdooProduct {
    id: number;
    name: string;
    default_code: string | false;
    list_price: number;
    qty_available: number;
    x_statu?: string;
    x_area?: number;
    x_mz?: string;
    x_etapa?: string;
    x_lote?: string;
    x_cliente?: string | false;
}

// --- Server-Side Fetch Utility ---
// NOTA: Esta función DEBE usarse solo en Server Components o API Routes.
// No la uses directamente en Client Components porque process.env no estará disponible.
export async function fetchOdoo(
    model: string,
    method: string,
    args: unknown[],
    kwargs: Record<string, unknown> = {}
) {
    const url = process.env.ODOO_URL;
    if (!url) {
        // Fallback for debugging if run on client by mistake, though it will fail cors likely
        console.error("Missing ODOO_URL. Ensure this is called server-side.");
    }

    const payload = {
        jsonrpc: "2.0",
        method: "call",
        params: {
            service: "object",
            method: "execute_kw",
            args: [
                process.env.ODOO_DB,
                parseInt(process.env.ODOO_USER_ID || "0"),
                process.env.ODOO_PASSWORD,
                model,
                method,
                args,
                kwargs
            ]
        },
        id: 2
    };

    try {
        const res = await fetch(url!, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            cache: "no-store",
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`Odoo HTTP Error ${res.status}: ${text}`);
        }

        const data = await res.json();

        if (data.error) {
            console.error("Odoo JSON-RPC Error:", JSON.stringify(data.error, null, 2));
            throw new Error(`Odoo Error: ${data.error.message} - ${data.error.data?.message || ''}`);
        }





        return data.result;
    } catch (error) {
        console.error("Fetch Odoo Error:", error);
        throw error;
    }
}

// --- Client-Side Auth Service ---
export const odooService = {
    async login(login: string, pass: string): Promise<OdooUser> {
        // We will hit our own API route which will handle the proxying
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login, password: pass }),
        });

        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || 'Authentication Failed');
        }

        // Return the user data structure
        return result.user;
    },

    // Generic search_read for querying Odoo models
    async searchRead<T = Record<string, unknown>>(
        model: string,
        domain: (string | [string, string, unknown])[],
        fields: string[] = []
    ): Promise<T[]> {
        const response = await fetch('/api/odoo/search-read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, domain, fields })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Search failed');
        }

        const data = await response.json();
        return data.records || [];
    },

    // Generic read for fetching specific records
    async read<T = Record<string, unknown>>(
        model: string,
        id: number | number[],
        fields: string[] = []
    ): Promise<T | T[]> {
        const ids = Array.isArray(id) ? id : [id];

        const response = await fetch('/api/odoo/read', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, ids, fields })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Read failed');
        }

        const data = await response.json();
        const records = data.records || [];
        return Array.isArray(id) ? records : records[0];
    },

    // Generic call for executing Odoo model methods
    async call(
        model: string,
        method: string,
        args: unknown[] = [],
        kwargs: Record<string, unknown> = {}
    ): Promise<unknown> {
        const response = await fetch('/api/odoo/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, method, args, kwargs })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Call failed');
        }

        const data = await response.json();
        return data.result;
    },

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async getSalesCount(_partnerId: number): Promise<number> {
        // Placeholder for future implementation
        return 0;
    },

    async getSalesStats(userId: number): Promise<{ sold: number, reserved: number, draft: number, totalValue: number }> {
        const response = await fetch(`/api/odoo/stats?userId=${userId}`);
        const result = await response.json();

        if (!result.success) {
            console.error("Failed to fetch stats:", result.error);
            return { sold: 0, reserved: 0, draft: 0, totalValue: 0 };
        }

        return result.stats;
    },

    async updateLotStatus(productId: string | number, status: string, clientName?: string): Promise<boolean> {
        try {
            const response = await fetch('/api/odoo/update_status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ productId, newStatus: status, clientName }),
            });
            const result = await response.json();
            if (!result.success) {
                throw new Error(result.error || "Error desconocido en API");
            }
            return true;
        } catch (error) {
            console.error("Error updating status:", error);
            throw error;
        }
    },

    async getDetailedSalesStats(userId: number, startDate?: string, endDate?: string): Promise<{
        kpis: { totalSales: number; monthlyGoal: number; commission: number; pendingLeads: number; conversionRate?: number; pipelineValue?: number };
        salesTrend: { name: string; ventas: number }[];
        recentActivity: { id: number; action: string; lot: string; date: string }[];
        competedLots: { lot: string; stage: string; quotes: { client: string; advisor: string; hours: number }[] }[];
        assignedLots: { lot: string; stage: string; client: string; status: string; price: number }[];
    }> {
        let url = `/api/odoo/stats/detailed?userId=${userId}`;
        if (startDate) url += `&startDate=${startDate}`;
        if (endDate) url += `&endDate=${endDate}`;
        const response = await fetch(url);
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "Failed to fetch detailed stats");
        }

        return result.stats;
    },

    async getGeneralProjectStats(userId: number, isSystem: boolean, startDate?: string, endDate?: string): Promise<{
        kpis: {
            totalSales: number;
            projectValue: number;
            commission: number;
            occupationRate: number;
            totalLots: number;
            soldLots: number;
            reservedLots: number;
            availableLots: number;
        };
        salesTrend: { name: string; ventas: number }[];
        advisorRanking: { name: string; lotsCount: number; amountTotal: number; commission: number }[];
        recentActivity: { id: number; action: string; lot: string; advisor: string; date: string }[];
    }> {
        let url = '/api/odoo/stats/general';
        const params = new URLSearchParams();
        if (startDate) params.set('startDate', startDate);
        if (endDate) params.set('endDate', endDate);
        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url, {
            headers: {
                'X-User-Id': String(userId),
                'X-Is-System': String(isSystem)
            }
        });
        const result = await response.json();

        if (!result.success) {
            throw new Error(result.error || "Failed to fetch general stats");
        }

        return result.stats;
    },

    // --- LEVEL 2: Real Exchange Architecture (Sales & Partners) ---

    // 1. Search for clients (res.partner) for the dropdown
    async searchPartners(query: string): Promise<Record<string, unknown>[]> {
        if (!query) return [];
        try {
            const response = await fetch('/api/odoo/search_partners', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            return result.results;
        } catch (error) {
            console.error("Error searching partners:", error);
            return [];
        }
    },

    // 1b. Create a new client/partner in Odoo
    async createPartner(data: { name: string; vat: string; phone?: string; email?: string }): Promise<{ id: number; name: string }> {
        try {
            const response = await fetch('/api/odoo/create_partner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            return { id: result.partnerId, name: data.name };
        } catch (error) {
            console.error("Error creating partner:", error);
            throw error;
        }
    },

    async createSaleOrder(
        partnerId: number,
        defaultCode: string,
        price: number,
        notes?: string,
        userId?: number,
        quoteDetails?: {
            installments?: number;
            downPayment?: number;
            discount?: number;
            firstInstallmentDate?: string;
        }
    ): Promise<number> {
        try {
            const response = await fetch('/api/odoo/create_sale_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ partnerId, defaultCode, price, notes, userId, quoteDetails }),
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            console.log(`✅ Sale Order Created: ${result.orderId}`);
            return result.orderId;
        } catch (error) {
            console.error("Error creating sale order:", error);
            throw error;
        }
    },

    // 3. Attach Evidence to the Order
    async addAttachmentToOrder(orderId: number, file: File): Promise<boolean> {
        try {
            const formData = new FormData();
            formData.append('orderId', orderId.toString());
            formData.append('file', file);

            const response = await fetch('/api/odoo/add_attachment', {
                method: 'POST',
                body: formData,
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            console.log(`✅ Attachment uploaded: ${file.name}`);
            return true;
        } catch (error) {
            console.error("Error uploading attachment:", error);
            throw error;
        }
    },

    // Get active quotes (draft sales orders) for a specific lot
    async getActiveQuotesByLot(defaultCode: string, userId?: number): Promise<{ count: number; quotes: Record<string, unknown>[] }> {
        try {
            const response = await fetch('/api/odoo/get_active_quotes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultCode, userId })
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.error);
            return {
                count: result.quotes?.length || 0,
                quotes: result.quotes || []
            };
        } catch (error) {
            console.error("Error fetching active quotes:", error);
            return { count: 0, quotes: [] };
        }
    },

    // Refactored Reserve Method to use the new flow
    // This is the "Orchestrator" function called by the UI
    async processReservationLevel2(lotDefaultCode: string, partnerId: number, price: number, files: File[], notes: string, separationAmount?: number) {
        try {
            // Step A: Create the Order in Odoo (Draft state)
            const orderId = await this.createSaleOrder(partnerId, lotDefaultCode, price, notes);
            console.log("✅ Sale Order Created:", orderId);

            // Step B: Upload Payment Evidence for each file
            for (const f of files) {
                await this.addAttachmentToOrder(orderId, f);
            }
            console.log("✅ All payment proofs attached to order");

            // Step C: Confirm Order (Draft -> Sale)
            const confirmRes = await fetch('/api/odoo/confirm_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, separationAmount })
            });
            const confirmResult = await confirmRes.json();
            if (!confirmResult.success) {
                // If confirmation fails (e.g. Odoo automation error), we still have the draft order
                // We throw so the UI shows the error
                throw new Error(confirmResult.error || 'Failed to confirm order');
            }
            console.log("✅ Order confirmed (State: Sale)");

            // Step D: Create Recurring Contract (BACKUP/MANUAL MODE)
            // We call this explicitly from Next.js to ensure it happens
            // even if the Odoo Automated Action was disabled or failed silently.
            try {
                const contract = await this.createRecurringContract(orderId);
                console.log("✅ Contract created successfully by Orchestrator:", contract.contractId);
            } catch (contractError) {
                console.warn("⚠️ Contract creation warning (might be duplicate or Odoo Auto-Action ran first):", contractError);
                // We don't fail the whole process if just the contract step glitches, 
                // because the sale is already confirmed and money is safe.
            }

            // Step E: Update Lot Status to 'reservado'
            // We can try to look up the product ID if we don't have it, or rely on Odoo
            console.log("ℹ️ Pending: Lot status update to 'reservado' (should be handled by Odoo or separate call)");

            return { success: true, orderId };
        } catch (error) {
            console.error("❌ Level 2 Reservation Failed:", error);
            throw error;
        }
    },

    // Confirm a local quote and create it in Odoo
    async confirmLocalQuote(
        lotDefaultCode: string,
        clientData: { id?: number; name: string; vat?: string; phone?: string; email?: string },
        price: number,
        notes: string,
        quoteDetails: {
            installments: number;
            downPayment: number;
            discount: number;
            firstInstallmentDate: string;
        },
        pdfFile?: File, // Archivo de cotización PDF opcional
        userId?: number // ID del usuario logueado para asignar como vendedor
    ): Promise<{ orderId: number; partnerId: number }> {
        try {
            // Step 1: Create or find partner (skip if we already have an ID)
            let partnerId = clientData.id;

            if (!partnerId) {
                if (!clientData.vat) {
                    throw new Error('VAT/DNI is required to confirm quote for new clients');
                }
                const partner = await this.createPartner({
                    name: clientData.name,
                    vat: clientData.vat,
                    phone: clientData.phone,
                    email: clientData.email
                });
                partnerId = partner.id;
                console.log("✅ Partner Created:", partnerId);
            } else {
                console.log("✅ Using Existing Partner:", partnerId);
            }

            // Step 2: Create sale order in draft state with extended details
            const orderId = await this.createSaleOrder(
                partnerId,
                lotDefaultCode,
                price,
                notes,
                userId,
                quoteDetails
            );
            console.log("✅ Sale Order Created:", orderId);

            // Step 3: Update lot status to 'cotizacion'
            // Note: We need to search for the product by default_code first
            const products = await fetch('/api/odoo/search_product_by_code', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultCode: lotDefaultCode })
            }).then(r => r.json());

            if (products.success && products.productId) {
                // Pass the client name to be saved in x_cliente
                await this.updateLotStatus(products.productId, 'cotizacion', clientData.name);
                console.log("✅ Lot status updated to 'cotizacion' with client: " + clientData.name);
            }

            // Step 4: Attach PDF Quote if provided (and valid)
            if (pdfFile && pdfFile instanceof File) {
                await this.addAttachmentToOrder(orderId, pdfFile);
                console.log("✅ Quote PDF attached to order");
            } else if (pdfFile) {
                console.warn("⚠️ PDF passed is not a File object, skipping attachment:", pdfFile);
            }

            return { orderId, partnerId };
        } catch (error) {
            console.error("❌ Quote Confirmation Failed:", error);
            throw error;
        }
    },

    // Reserve a lot that already has a confirmed quote (draft order)
    async reserveQuotedLot(orderId: number, file: File | File[], notes: string, userId?: number, separationAmount?: number) {
        try {
            // 1. Fetch the existing draft order details using the new API feature
            const searchRes = await fetch('/api/odoo/find_draft_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, userId })
            }).then(r => r.json());

            if (!searchRes.success || !searchRes.order) {
                throw new Error("No se pudo encontrar los detalles de la cotización en Odoo.");
            }

            const { productId, productTmplId, partnerName } = searchRes.order;
            console.log(`✅ Found existing draft order: ${orderId} for product ${productId}, Client: ${partnerName}`);

            // 2. Upload Payment Evidence
            const filesArray = Array.isArray(file) ? file : [file];
            for (const f of filesArray) {
                await this.addAttachmentToOrder(orderId, f);
            }
            console.log("✅ All payment proofs attached to existing order");

            // 3. CONFIRM ORDER (Draft -> Sale) - FIRST RESERVE WINS!
            const confirmRes = await fetch('/api/odoo/confirm_order', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, separationAmount })
            });
            const confirmResult = await confirmRes.json();
            if (!confirmResult.success) {
                throw new Error(confirmResult.error || 'Failed to confirm order');
            }
            console.log("🏆 Order confirmed! This reservation WINS the lot.");

            // 3.5 ORCHESTRATION (Plan B): Create Recurring Contract Manually
            try {
                const contract = await this.createRecurringContract(orderId);
                console.log("✅ Contract created successfully via Plan B:", contract.contractId);
            } catch (contractError) {
                console.warn("⚠️ Contract creation warning (User should check Odoo):", contractError);
                // Non-blocking: The sale is already confirmed, so we proceed.
            }

            // 4. Update Lot Status to 'reservado' AND Force Client Name Update
            // Use Template ID if available (because update_status uses product.template), else fallback to Variant ID
            if (productTmplId) {
                // FORCE WRITE the client name from the winning order to ensure data consistency
                await this.updateLotStatus(productTmplId, 'reservado', partnerName);
                console.log(`✅ Lot status updated to 'reservado' with Client '${partnerName}' (Template: ${productTmplId})`);
            } else if (productId) {
                await this.updateLotStatus(productId, 'reservado', partnerName);
                console.log(`✅ Lot status updated to 'reservado' with Client '${partnerName}' (Variant: ${productId})`);
            }

            return { success: true, orderId };
        } catch (error) {
            console.error("❌ Reserve Quoted Lot Failed:", error);
            throw error;
        }
    },



    // Get the owner of a reserved lot (Salesperson who confirmed the order)
    // Process a refund: creates credit note if invoice exists, otherwise cancels the order
    async processRefund(orderId: number, refundAmount: number, reason: string): Promise<{ success: boolean; action?: string; newLotStatus?: string; error?: string }> {
        try {
            const response = await fetch('/api/odoo/process_refund', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId, refundAmount, reason })
            });
            const result = await response.json();
            return result;
        } catch (error) {
            console.error("Error processing refund:", error);
            return { success: false, error: error instanceof Error ? error.message : 'Error desconocido' };
        }
    },

    // Get the owner of a reserved lot (Salesperson who confirmed the order)
    async getReservationOwner(defaultCode: string): Promise<{ ownerId: number; ownerName: string; partnerId: number; clientName: string; totalInstallments: number; orderId: number; separationAmount?: number | null } | null> {
        try {
            const response = await fetch('/api/odoo/get_reservation_owner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ defaultCode })
            });
            const result = await response.json();
            if (!result.success || !result.ownerId) return null;
            return {
                ownerId: result.ownerId,
                ownerName: result.ownerName,
                partnerId: result.partnerId,
                clientName: result.clientName,
                totalInstallments: result.totalInstallments || 72,
                orderId: result.orderId,
                separationAmount: result.separationAmount
            };
        } catch (error) {
            console.error("Error fetching reservation owner:", error);
            return null;
        }
    },

    // Get invoices for a specific client (partner_id) and optionally filter by product (lot)
    async getClientInvoices(partnerId: number, productCode?: string): Promise<Record<string, unknown>[]> {
        try {
            const response = await fetch('/api/odoo/get_client_invoices', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    partnerId,
                    productCode // 🆕 Pasar código del producto para filtrar
                })
            });
            const result = await response.json();
            if (!result.success) return [];
            return result.invoices || [];
        } catch (error) {
            console.error("Error fetching client invoices:", error);
            return [];
        }
    },

    // --- MOCK: Reservation Logic with Evidence (Legacy/Simple) ---
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async reserveLotWithEvidence(productId: number, userId: number, file: File, notes: string): Promise<unknown> {
        // Deprecated in favor of processReservationLevel2 for the new flow,
        // but kept for backward compatibility if needed.
        return this.updateLotStatus(productId, 'separado');
    },

    // --- MOCK: Locking System ---
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    async checkLotLock(productId: number): Promise<{ isLocked: boolean; lockedBy?: string }> {
        // Simulation: Lots ending in '5' are locked by another user
        // In production, this would call a real endpoint checking an ephemeral lock (Redis/Odoo)
        return { isLocked: false }; // The UI does the mock logic for now based on name
    },

    // --- MOCK: Management Dashboard ---
    async getPendingReservations(): Promise<Record<string, unknown>[]> {
        // Simulate a delay
        await new Promise(resolve => setTimeout(resolve, 800));

        return [
            {
                id: 101,
                lotName: "A-05",
                advisor: "Carlos V.",
                customer: "Juan Pérez",
                date: "Hace 10 min",
                amount: 156000,
                evidenceUrl: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?auto=format&fit=crop&q=80&w=300&h=400", // Sample receipt
                status: "pending_approval"
            },
            {
                id: 102,
                lotName: "C-12",
                advisor: "Ana M.",
                customer: "Maria Rodriguez",
                date: "Hace 2 horas",
                amount: 142000,
                evidenceUrl: "https://images.unsplash.com/photo-1628102491629-778571d893a3?auto=format&fit=crop&q=80&w=300&h=400", // Sample receipt
                status: "pending_approval"
            }
        ];
    },

    async approveReservation(reservationId: number): Promise<boolean> {
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`[MOCK] Review approved for reservation ${reservationId}`);
        return true;
    },

    async rejectReservation(reservationId: number, reason: string): Promise<boolean> {
        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`[MOCK] Review rejected for reservation ${reservationId}. Reason: ${reason}`);
        // In real app, this would free the lot (updateLotStatus -> libre)
        return true;
    },

    // Create recurring contract from sale order
    async createRecurringContract(saleOrderId: number): Promise<{ contractId: number; details: unknown }> {
        try {
            const response = await fetch('/api/odoo/create_contract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ saleOrderId })
            });
            const result = await response.json();

            if (!result.success) {
                throw new Error(result.error || 'Failed to create contract');
            }

            console.log(`✅ Recurring Contract Created: ${result.contractId}`);
            return {
                contractId: result.contractId,
                details: result.details
            };
        } catch (error) {
            console.error("Error creating recurring contract:", error);
            throw error;
        }
    },

    // --- LEVEL 3: Payment Registration (In Payment Status) ---
    // Pasa por el endpoint asegurado del módulo Odoo (/api/simple_contract/pay_invoice:
    // API key propia, rate limit, y chequeo de que la factura pertenece a un
    // contrato/compañía accesible) en vez de crear account.payment.register
    // directo con la cuenta admin compartida. El endpoint ya resuelve el
    // diario y el payment_method_line_id por su cuenta si no se especifican.
    async createPayment(
        invoiceId: number,
        amount: number,
        paymentDate: string,
        paymentRef: string,
        journalId?: number,
        partnerId?: number
    ): Promise<unknown> {
        const response = await fetch('/api/odoo/pay-invoice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                invoiceId,
                amount,
                paymentDate,
                ref: paymentRef,
                journalId,
                partnerId,
            }),
        });

        const result = await response.json();
        if (!result.success) {
            throw new Error(result.error || result.message || 'Error al registrar el pago');
        }
        return result;
    }
};
