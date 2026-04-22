import fp from 'fastify-plugin';

declare module 'fastify' {
  interface FastifyRequest {
    authUser: null | {
      id: string;
      email: string;
    };
  }
}

export const authPlugin = fp(async (app) => {
  app.decorateRequest('authUser', null);
});
