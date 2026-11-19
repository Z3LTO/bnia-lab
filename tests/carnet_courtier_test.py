"""Test de bout en bout de Carnet Courtier (courtier/index.html), avec une base Supabase simulée.
Lancer : python3 tests/carnet_courtier_test.py   (nécessite playwright + chromium)"""
import asyncio, pathlib, sys
from playwright.async_api import async_playwright

PAGE = pathlib.Path(__file__).resolve().parent.parent / 'courtier' / 'index.html'
OUT = pathlib.Path('/tmp/cc_shots'); OUT.mkdir(exist_ok=True)

# Faux client Supabase : comptes, table membres et table carnets en mémoire.
MOCK = r"""
window.DB={users:{'ami@test.fr':{id:'u1',pw:'secret1'},'attente@test.fr':{id:'u2',pw:'secret2'}},membres:{u1:'utilisateur'},carnets:{}};
window.supabase={createClient:(url,key,opt)=>{window._opt=opt;let cb=null,session=null;
 const fire=()=>setTimeout(()=>cb&&cb('X',session),0);
 const tbl=t=>({select:()=>({eq:(k,v)=>({maybeSingle:async()=>{
     if(t==='membres')return{data:DB.membres[v]?{role:DB.membres[v]}:null};
     return{data:DB.carnets[v]?{data:JSON.parse(DB.carnets[v])}:null}}})}),
   insert:async r=>{if(!DB.membres[r.user_id])return{error:{message:'RLS'}};DB.carnets[r.user_id]=JSON.stringify(r.data);return{}},
   upsert:async r=>{if(!DB.membres[r.user_id])return{error:{message:'RLS'}};DB.carnets[r.user_id]=JSON.stringify(r.data);return{}}});
 return{from:tbl,auth:{
   onAuthStateChange:f=>{cb=f;fire()},
   signInWithPassword:async({email,password})=>{const u=DB.users[email];if(!u||u.pw!==password)return{error:{message:'Invalid login credentials'}};session={user:{id:u.id,email}};fire();return{}},
   signUp:async({email,password})=>{if(DB.users[email])return{error:{message:'User already registered'}};DB.users[email]={id:'n'+Date.now(),pw:password};return{data:{session:null}}},
   signOut:async()=>{session=null;fire()}}}}};
"""

errors, checks = [], []
def ok(cond, label):
    checks.append(label);
    if not cond: errors.append(label)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w in (360, 390, 430):
            pg = await b.new_page(viewport={'width': w, 'height': 780}, device_scale_factor=2)
            pg.on('pageerror', lambda e: errors.append('JS: ' + str(e)))
            await pg.route('**/supabase-js@2', lambda r: r.fulfill(body=MOCK, content_type='application/javascript'))
            await pg.route('**/fonts.googleapis.com/**', lambda r: r.abort())
            await pg.route('https://app.test/', lambda r: r.fulfill(body=PAGE.read_text(), content_type='text/html'))
            await pg.goto('https://app.test/'); await pg.wait_for_timeout(300)
            wide = await pg.evaluate('document.documentElement.scrollWidth>innerWidth')
            ok(not wide, f'{w}px : pas de défilement horizontal (connexion)')
            if w != 390: await pg.close(); continue

            ok(await pg.evaluate("_opt&&_opt.db&&_opt.db.schema==='courtier'"), 'client Supabase sur le schéma courtier')
            await pg.screenshot(path=str(OUT / 'login.png'))
            # mauvais mot de passe
            await pg.fill('#lgE', 'ami@test.fr'); await pg.fill('#lgP', 'mauvais'); await pg.click('#lgB'); await pg.wait_for_timeout(100)
            ok('incorrect' in await pg.inner_text('#lgErr'), 'message mot de passe incorrect')
            # inscription
            await pg.click('#lgSw'); ok(await pg.inner_text('#lgB') == 'Créer mon compte', 'bascule inscription')
            await pg.fill('#lgE', 'nouveau@test.fr'); await pg.fill('#lgP', 'abcdef'); await pg.click('#lgB'); await pg.wait_for_timeout(100)
            ok('Compte créé' in await pg.inner_text('#lgErr'), 'inscription confirmée')
            await pg.evaluate("mode='in';lgUI()")
            # compte non membre
            await pg.fill('#lgE', 'attente@test.fr'); await pg.fill('#lgP', 'secret2'); await pg.click('#lgB'); await pg.wait_for_timeout(200)
            ok(await pg.is_visible('#lgWait') and not await pg.is_visible('#lgBox'), 'compte non membre : écran « en attente »')
            await pg.screenshot(path=str(OUT / 'attente.png'))
            await pg.click('#lgWait button'); await pg.wait_for_timeout(100)
            ok(await pg.is_visible('#lgBox'), 'déconnexion depuis l’écran d’attente')
            # membre
            await pg.fill('#lgE', 'ami@test.fr'); await pg.fill('#lgP', 'secret1'); await pg.click('#lgB'); await pg.wait_for_timeout(300)
            ok(await pg.evaluate("!document.body.classList.contains('out')"), 'membre connecté')
            ok(await pg.evaluate("'u1' in DB.carnets"), 'carnet créé en base au premier login')
            # accueil guidé
            ok(await pg.is_visible('.welcome'), 'carte de bienvenue au premier lancement')
            await pg.click("text=C'est parti"); ok(not await pg.is_visible('.welcome'), 'bienvenue masquée')
            ok(await pg.is_visible('.hint'), 'astuce de la journée affichée')
            await pg.click('.hint .x'); ok(not await pg.is_visible('.hint'), 'astuce masquée')
            await pg.wait_for_timeout(700)
            ok('"bienvenue":1' in await pg.evaluate("DB.carnets.u1"), 'choix gardé en base')
            # journée
            await pg.fill('.slot.s1 .add input', 'Étudier dossier Dupont'); await pg.click('.slot.s1 .add .btn'); await pg.wait_for_timeout(50)
            ok('Étudier dossier Dupont' in await pg.inner_text('.slot.s1'), 'ajout tâche dans un créneau')
            await pg.click('.slot.s1 .ck'); ok(await pg.inner_text('.kpi b') == '1/1', 'tâche cochée, compteur à jour')
            ok('bravo' in await pg.inner_text('#toast'), 'félicitation quand la journée est bouclée')
            await pg.wait_for_timeout(700)
            ok('Dupont' in await pg.evaluate("DB.carnets.u1"), 'journée enregistrée en base')
            await pg.screenshot(path=str(OUT / 'jour.png'))
            # note d'appel
            await pg.click('nav button[data-v=appel]')
            await pg.fill('input[placeholder=Prénom]', 'Léa'); await pg.fill('input[placeholder=Nom]', "D'Amico")
            await pg.fill('input[placeholder=Téléphone]', '06 11 22 33 44'); await pg.fill('input[placeholder=Email]', 'lea@exemple.fr')
            await pg.click('text=Rachat crédits conso')
            await pg.fill('input[placeholder="Revenus €"]', '2500'); await pg.fill('input[placeholder="Mensual. €"]', '1000')
            ok('40\xa0%' in await pg.inner_text('#endet'), "calcul du taux d'endettement")
            await pg.fill('textarea', 'Veut passer sous 600 € par mois.')
            await pg.click("text=Pièce d'identité")
            await pg.fill('input[placeholder^="Ex. : le rappeler"]', 'Rappeler Léa pour les pièces')
            await pg.click('.when .chip >> text=J+2')
            await pg.screenshot(path=str(OUT / 'appel.png'), full_page=True)
            await pg.click('text=Enregistrer l\'appel'); await pg.wait_for_timeout(100)
            ok('Pièces manquantes : Pièce d\'identité' in await pg.inner_text('pre.out'), 'résumé CRM complet')
            await pg.click('text=Copier pour le CRM')  # ne doit pas planter
            await pg.click('text=Fermer')
            ok(await pg.evaluate("S.taches.some(t=>t.t.includes('Léa')&&t.due===addD(TODAY,2))"), 'rappel créé à J+2')
            ok(await pg.evaluate("S.clients[0].statut==='Pièces en attente'"), 'statut passé à Pièces en attente')
            # recherche client
            await pg.evaluate("go('appel')"); await pg.fill('#cS', 'da'); ok(await pg.inner_text('#cSug') == '', 'pas de suggestion à 2 lettres')
            await pg.fill('#cS', 'dam'); ok("D'Amico" in await pg.inner_text('#cSug'), 'suggestion à 3 lettres (apostrophe)')
            await pg.fill('#cS', '0611'); ok("D'Amico" in await pg.inner_text('#cSug'), 'recherche par téléphone')
            await pg.click('#cSug .item'); ok(await pg.input_value('input[placeholder=Nom]') == "D'Amico", 'fiche préremplie')
            # à faire
            await pg.click('nav button[data-v=rappels]')
            ok('Rappeler Léa' in await pg.inner_text('main'), 'rappel visible dans À faire')
            await pg.fill('form.card input[name=t]', 'Appeler la banque'); await pg.select_option('form.card select[name=q]', '0'); await pg.click('form.card .btn')
            ok(await pg.inner_text('#badge') == '1', 'badge des rappels du jour')
            await pg.fill('form.card input[name=t]', 'Rappeler M. Petit'); await pg.select_option('form.card select[name=c]', '+')
            ok(await pg.is_visible('#nvC'), 'champs nouveau client affichés')
            await pg.fill('#nvC input[name=nn]', 'Petit'); await pg.fill('#nvC input[name=nt]', '0600000000'); await pg.click('form.card .btn')
            ok(await pg.evaluate("S.clients.some(c=>c.nom==='Petit'&&c.tel==='0600000000')&&S.taches.some(t=>t.t==='Rappeler M. Petit'&&cli(t.c).nom==='Petit')"), 'rappel avec création de client')
            await pg.click('main .item:has-text("Appeler la banque") >> text=+1 j')
            ok(await pg.evaluate("S.taches.find(t=>t.t==='Appeler la banque').due===addD(TODAY,1)"), 'report +1 jour')
            await pg.screenshot(path=str(OUT / 'rappels.png'), full_page=True)
            # mails
            await pg.click('nav button[data-v=mails]')
            await pg.select_option('main select', label="Léa D'Amico")
            body = await pg.input_value('#mB')
            ok('Bonjour Léa' in body and "Pièce d'identité" in body, 'mail prérempli (prénom + pièces)')
            ok(await pg.input_value('#mTo') == 'lea@exemple.fr', 'destinataire rempli')
            await pg.click("button:has-text(\"Je l'ai envoyé\")"); ok(await pg.inner_text('.kpi b') == '1', 'compteur de mails')
            await pg.screenshot(path=str(OUT / 'mails.png'), full_page=True)
            # clients
            await pg.click('nav button[data-v=clients]'); await pg.click('.card.cli:has-text("D\'Amico")')
            await pg.click('.chip >> text=Transmis banque'); ok(await pg.evaluate("S.clients.find(c=>c.nom.startsWith(\"D\")).statut==='Transmis banque'"), 'changement de statut')
            await pg.click('button[aria-label="Pièce reçue"]'); ok(await pg.evaluate("S.clients.find(c=>c.nom.startsWith(\"D\")).pieces.length===0"), 'pièce cochée reçue')
            await pg.screenshot(path=str(OUT / 'fiche.png'), full_page=True)
            # semaine
            await pg.click('nav button[data-v=jour]'); await pg.click('.seg button >> text=Semaine')
            ok(await pg.locator('main .card').count() == 7, '7 jours dans la vue semaine')
            ok('Appeler la banque' not in await pg.inner_text('.card.today'), 'rappel reporté absent d’aujourd’hui')
            await pg.screenshot(path=str(OUT / 'semaine.png'), full_page=True)
            await pg.click('.seg button >> text=Jour'); ok(await pg.is_visible('.slot'), 'retour vue jour')
            # rechargement : les données reviennent de la base
            await pg.wait_for_timeout(700)
            saved = await pg.evaluate("DB.carnets.u1")
            ok("D'Amico" in saved and 'Transmis banque' in saved, 'tout est enregistré en base')
            for v in ('jour', 'appel', 'rappels', 'mails', 'clients'):
                await pg.click(f'nav button[data-v={v}]')
                ok(not await pg.evaluate('document.documentElement.scrollWidth>innerWidth'), f'390px : pas de défilement horizontal ({v})')
            await pg.click('header button[aria-label="Se déconnecter"]'); await pg.wait_for_timeout(100)
            ok(await pg.evaluate("document.body.classList.contains('out')"), 'déconnexion')
            await pg.close()
        await b.close()

asyncio.run(main())
print(f'{len(checks)-len(errors)}/{len(checks)} vérifications OK')
for e in errors: print('ÉCHEC :', e)
sys.exit(1 if errors else 0)
