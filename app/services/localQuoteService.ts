import { LocalQuote } from '@/app/types/localQuote';

/**
 * Local Quote Service
 * Manages quotations in browser LocalStorage
 */

const STORAGE_KEY = 'renasur_local_quotes';

export const localQuoteService = {
    /**
     * Save or update a quote in localStorage
     */
    saveQuote(quote: LocalQuote): void {
        try {
            const quotes = this.getAllQuotes();
            const existingIndex = quotes.findIndex(q => q.id === quote.id);

            if (existingIndex >= 0) {
                quotes[existingIndex] = { ...quote, updatedAt: new Date().toISOString() };
            } else {
                quotes.push(quote);
            }

            localStorage.setItem(STORAGE_KEY, JSON.stringify(quotes));
        } catch (error) {
            console.error('Error saving quote to localStorage:', error);
            throw new Error('Failed to save quote locally');
        }
    },

    /**
     * Get a specific quote by ID
     */
    getQuote(quoteId: string): LocalQuote | null {
        try {
            const quotes = this.getAllQuotes();
            return quotes.find(q => q.id === quoteId) || null;
        } catch (error) {
            console.error('Error retrieving quote:', error);
            return null;
        }
    },

    /**
     * Get all quotes from localStorage
     */
    getAllQuotes(): LocalQuote[] {
        try {
            const data = localStorage.getItem(STORAGE_KEY);
            return data ? JSON.parse(data) : [];
        } catch (error) {
            console.error('Error reading quotes from localStorage:', error);
            return [];
        }
    },

    /**
     * Get all quotes for a specific lot
     */
    getQuotesByLot(lotId: string): LocalQuote[] {
        try {
            const quotes = this.getAllQuotes();
            return quotes.filter(q => q.lotId === lotId)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        } catch (error) {
            console.error('Error getting quotes by lot:', error);
            return [];
        }
    },

    /**
     * Get the most recent confirmed quote for a lot
     */
    getConfirmedQuoteForLot(lotId: string): LocalQuote | null {
        try {
            const quotes = this.getQuotesByLot(lotId);
            return quotes.find(q => q.status === 'confirmed_odoo') || null;
        } catch (error) {
            console.error('Error getting confirmed quote:', error);
            return null;
        }
    },

    /**
     * Delete a quote
     */
    deleteQuote(quoteId: string): void {
        try {
            const quotes = this.getAllQuotes();
            const filtered = quotes.filter(q => q.id !== quoteId);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
        } catch (error) {
            console.error('Error deleting quote:', error);
            throw new Error('Failed to delete quote');
        }
    },

    /**
     * Update quote status and Odoo IDs after confirmation
     */
    markAsConfirmed(quoteId: string, odooOrderId: number, odooPartnerId: number): void {
        try {
            const quote = this.getQuote(quoteId);
            if (!quote) throw new Error('Quote not found');

            quote.status = 'confirmed_odoo';
            quote.odooOrderId = odooOrderId;
            quote.odooPartnerId = odooPartnerId;
            quote.updatedAt = new Date().toISOString();

            this.saveQuote(quote);
        } catch (error) {
            console.error('Error marking quote as confirmed:', error);
            throw error;
        }
    },

    /**
     * Generate a unique ID for a new quote
     */
    generateId(): string {
        return `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
};
