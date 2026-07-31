import mongoose from 'mongoose';

/**
 * Registers a mongoose model, safely across hot reloads.
 *
 * Next.js dev keeps the mongoose connection on `global`, so `mongoose.models.X`
 * survives an edit to the schema file. The usual
 * `mongoose.models.X || mongoose.model(...)` pattern then keeps handing back the
 * OLD compiled schema — and any newly added field is silently dropped on save
 * until the server is restarted, with no error to point at.
 *
 * In development we drop the cached model so the fresh schema wins. In
 * production modules evaluate once, so this is a plain lookup-or-create.
 */
export function registerModel<T>(name: string, schema: mongoose.Schema<T>): mongoose.Model<T> {
    if (process.env.NODE_ENV !== 'production' && mongoose.models[name]) {
        mongoose.deleteModel(name);
    }
    return (mongoose.models[name] as mongoose.Model<T>) || mongoose.model<T>(name, schema);
}
