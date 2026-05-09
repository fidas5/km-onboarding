# create_admin.py
import mysql.connector
from werkzeug.security import generate_password_hash

def create_admin():
    try:
        # Connexion directe à la base
        connection = mysql.connector.connect(
            host="localhost",
            user="admin",
            password="0000",
            database="onboarding"
        )
        cursor = connection.cursor(dictionary=True)
        
        print("🔄 Connexion à la base de données...")
        
        # Vérifier si un admin existe déjà
        cursor.execute("SELECT COUNT(*) as count FROM users WHERE role_id = 1")
        result = cursor.fetchone()
        admin_count = result['count'] if result else 0
        
        if admin_count > 0:
            print(f"✅ Un admin existe déjà ({admin_count} admin(s))")
            # Afficher les admins existants
            cursor.execute("SELECT id, name, email FROM users WHERE role_id = 1")
            admins = cursor.fetchall()
            for admin in admins:
                print(f"   - {admin['name']} ({admin['email']})")
            
            # Demander si on veut créer un autre admin
            réponse = input("\nVoulez-vous créer un autre admin ? (o/n): ")
            if réponse.lower() != 'o':
                cursor.close()
                connection.close()
                return
        
        # Créer le nouvel admin
        print("\n📝 Création d'un nouvel administrateur:")
        email = input("Email admin: ")
        name = input("Nom admin: ")
        password = input("Mot de passe admin: ")
        
        # Vérifier si l'email existe déjà
        cursor.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cursor.fetchone():
            print("❌ Cet email existe déjà !")
            cursor.close()
            connection.close()
            return
        
        hashed_password = generate_password_hash(password)
        
        cursor.execute("""
            INSERT INTO users (name, email, password, role_id, is_active)
            VALUES (%s, %s, %s, 1, 1)
        """, (name, email, hashed_password))
        
        connection.commit()
        
        print(f"\n✅ Admin créé avec succès !")
        print(f"   📧 Email: {email}")
        print(f"   👤 Nom: {name}")
        print(f"   🔑 Mot de passe: (celui que vous avez saisi)")
        
        cursor.close()
        connection.close()
        
    except mysql.connector.Error as e:
        print(f"❌ Erreur MySQL: {e}")
    except Exception as e:
        print(f"❌ Erreur: {e}")

if __name__ == "__main__":
    create_admin()