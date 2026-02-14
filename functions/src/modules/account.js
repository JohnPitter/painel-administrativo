const {
  express,
  admin,
  sanitizeString,
  authenticateRequest,
  getUserProfile,
  isSubscriptionActive,
  getAccountDocRef,
  fetchAccountProfile,
  inferAvatarExtension,
  ACCOUNT_AVATAR_MAX_SIZE,
} = require('../shared/base');

module.exports = () => {

  const accountRouter = express.Router();

  accountRouter.use(async (req, res, next) => {
    try {
      const uid = await authenticateRequest(req);
      req.auth = { uid };
      next();
    } catch (error) {
      if (error.code === 'UNAUTHENTICATED') {
        res.status(401).json({ message: 'Autenticação necessária.' });
        return;
      }
      console.error('[functions][account] auth middleware', error);
      res.status(500).json({ message: 'Erro interno ao validar autenticação.' });
    }
  });

  accountRouter.get('/profile', async (req, res) => {
    try {
      const profile = await fetchAccountProfile(req.auth.uid);
      res.json({ profile });
    } catch (error) {
      console.error('[functions][account] get profile', error);
      res.status(500).json({ message: 'Erro ao carregar perfil.' });
    }
  });

  accountRouter.patch('/profile', async (req, res) => {
    try {
      const { uid } = req.auth;
      const currentProfile = await getUserProfile(uid);
      if (!isSubscriptionActive(currentProfile)) {
        res.status(403).json({
          message: 'Sua assinatura está suspensa. Renove para editar o perfil.',
        });
        return;
      }
      const displayName = sanitizeString(req.body?.displayName);
      if (!displayName) {
        res.status(400).json({ message: 'Informe um nome válido.' });
        return;
      }
      await Promise.all([
        admin.auth().updateUser(uid, { displayName }),
        getAccountDocRef(uid).set(
          { displayName, updatedAt: new Date().toISOString() },
          { merge: true }
        ),
      ]);
      const profile = await fetchAccountProfile(uid);
      res.json({ profile });
    } catch (error) {
      console.error('[functions][account] update profile', error);
      res.status(500).json({ message: 'Erro ao atualizar nome.' });
    }
  });

  accountRouter.post('/avatar', async (req, res) => {
    try {
      const { uid } = req.auth;
      const currentProfile = await getUserProfile(uid);
      if (!isSubscriptionActive(currentProfile)) {
        res.status(403).json({
          message: 'Sua assinatura está suspensa. Renove para alterar a foto.',
        });
        return;
      }
      const base64Data = sanitizeString(req.body?.data);
      const contentType = sanitizeString(req.body?.contentType) || 'application/octet-stream';
      if (!base64Data) {
        res.status(400).json({ message: 'Envie o arquivo codificado em base64.' });
        return;
      }
      const buffer = Buffer.from(base64Data, 'base64');
      if (!buffer.byteLength) {
        res.status(400).json({ message: 'Arquivo inválido.' });
        return;
      }
      if (buffer.byteLength > ACCOUNT_AVATAR_MAX_SIZE) {
        res.status(413).json({ message: 'Arquivo acima de 4MB.' });
        return;
      }
      const extension = inferAvatarExtension(contentType, req.body?.fileName);
      const bucket = admin.storage().bucket();
      const objectName = `profile-photos/${uid}.${extension}`;
      const downloadToken = require('node:crypto').randomUUID();
      await bucket.file(objectName).save(buffer, {
        contentType,
        metadata: {
          metadata: {
            firebaseStorageDownloadTokens: downloadToken,
          },
        },
        resumable: false,
      });
      const photoURL = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(
        objectName
      )}?alt=media&token=${downloadToken}`;
      await Promise.all([
        admin.auth().updateUser(uid, { photoURL }),
        getAccountDocRef(uid).set(
          { photoURL, updatedAt: new Date().toISOString() },
          { merge: true }
        ),
      ]);
      const profile = await fetchAccountProfile(uid);
      res.json({ profile });
    } catch (error) {
      console.error('[functions][account] upload avatar', error);
      res.status(500).json({ message: 'Erro ao atualizar foto de perfil.' });
    }
  });

  accountRouter.post('/cancel', async (req, res) => {
    try {
      const { uid } = req.auth;
      const docRef = getAccountDocRef(uid);
      const profileData = await getUserProfile(uid);
      if (profileData?.subscriptionStatus === 'canceled') {
        res.status(403).json({ message: 'Sua assinatura já está cancelada.' });
        return;
      }
      const effectiveDate =
        typeof profileData?.activeUntil === 'string' && profileData.activeUntil
          ? profileData.activeUntil
          : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
      await docRef.set(
        {
          subscriptionStatus: 'pending_cancel',
          cancellationRequestedAt: new Date().toISOString(),
          activeUntil: effectiveDate,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
      const profile = await fetchAccountProfile(uid);
      res.json({ profile });
    } catch (error) {
      console.error('[functions][account] cancel subscription', error);
      res.status(500).json({ message: 'Erro ao cancelar assinatura.' });
    }
  });

  return accountRouter;
};
