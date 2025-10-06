class QueryBuilder {
    constructor() {
        this.query = {
            select: [],
            from: '',
            where: [],
            joins: [],
            orderBy: [],
            groupBy: [],
            limit: null,
            offset: null
        };
        this.params = [];
    }

    select(fields) {
        this.query.select = Array.isArray(fields) ? fields : [fields];
        return this;
    }

    from(table) {
        this.query.from = table;
        return this;
    }

    where(condition, value) {
        if (typeof condition === 'object') {
            Object.entries(condition).forEach(([key, val]) => {
                this.query.where.push(`${key} = ?`);
                this.params.push(val);
            });
        } else {
            this.query.where.push(condition);
            if (value !== undefined) {
                this.params.push(value);
            }
        }
        return this;
    }

    join(table, condition, type = 'INNER') {
        this.query.joins.push({
            table,
            condition,
            type
        });
        return this;
    }

    orderBy(field, direction = 'ASC') {
        this.query.orderBy.push(`${field} ${direction}`);
        return this;
    }

    limit(count) {
        this.query.limit = count;
        return this;
    }

    offset(count) {
        this.query.offset = count;
        return this;
    }

    build() {
        const parts = [];

        // SELECT
        if (this.query.select.length > 0) {
            parts.push(`SELECT ${this.query.select.join(', ')}`);
        } else {
            parts.push('SELECT *');
        }

        // FROM
        parts.push(`FROM ${this.query.from}`);

        // JOINS
        this.query.joins.forEach(join => {
            parts.push(`${join.type} JOIN ${join.table} ON ${join.condition}`);
        });

        // WHERE
        if (this.query.where.length > 0) {
            parts.push(`WHERE ${this.query.where.join(' AND ')}`);
        }

        // ORDER BY
        if (this.query.orderBy.length > 0) {
            parts.push(`ORDER BY ${this.query.orderBy.join(', ')}`);
        }

        // LIMIT
        if (this.query.limit) {
            parts.push(`LIMIT ${this.query.limit}`);
        }

        // OFFSET
        if (this.query.offset) {
            parts.push(`OFFSET ${this.query.offset}`);
        }

        return {
            sql: parts.join(' '),
            params: this.params
        };
    }

    reset() {
        this.query = {
            select: [],
            from: '',
            where: [],
            joins: [],
            orderBy: [],
            groupBy: [],
            limit: null,
            offset: null
        };
        this.params = [];
        return this;
    }
}

export default QueryBuilder;