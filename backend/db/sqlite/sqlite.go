package sqlite

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/golang-migrate/migrate/v4"
	"github.com/golang-migrate/migrate/v4/database/sqlite3"
	_ "github.com/golang-migrate/migrate/v4/source/file"
	_ "github.com/mattn/go-sqlite3"
)

var DB *sql.DB

func InitDB() {
	var err error
	os.MkdirAll("./data", 0755)
	DB, err = sql.Open("sqlite3", "./data/social.db?charset=utf8")
	if err != nil {
		log.Fatal("Failed to open DB:", err)
	}

	applyMigrations()
}

func GetDB() *sql.DB {
	return DB
}

func applyMigrations() {
	driver, err := sqlite3.WithInstance(DB, &sqlite3.Config{})
	if err != nil {
		log.Fatalf("Failed to create migrate sqlite driver: %v", err)
	}

	m, err := migrate.NewWithDatabaseInstance(
		"file://db/migrations/sqlite",
		"sqlite3", driver)
	if err != nil {
		log.Fatalf("Failed to create migrate instance: %v", err)
	}

	err = m.Up()
	if err != nil && err != migrate.ErrNoChange {
		log.Fatalf("Migration failed: %v", err)
	}

	fmt.Println("✅ Migrations applied successfully")
}
