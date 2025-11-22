package services

import (
	"errors"
	"social/models"
	"social/repositories"

	"golang.org/x/crypto/bcrypt"
)

type AuthService struct {
	UserRepo repositories.SqliteUserRepo
}

func NewService(repo repositories.SqliteUserRepo) *AuthService {
	return &AuthService{UserRepo: repo}
}

func (a *AuthService) Login(email, password string) (*models.User, error) {
	user, hashedPwd, err := a.UserRepo.FindUserWithPasswordByEmail(email)
	if err != nil {
		return nil, errors.New("user not found")
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hashedPwd), []byte(password)); err != nil {
		return nil, errors.New("invalid credentials")
	}

	return user, nil
}

func (a *AuthService) Register(form models.RegisterRequest) error {
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(form.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}

	user := &models.User{
		Email:       form.Email,
		Password:    string(hashedPassword),
		FirstName:   form.FirstName,
		LastName:    form.LastName,
		DateOfBirth: form.DateOfBirth,
		Nickname:    form.Nickname,
		About:       form.About,
		Avatar:      form.Avatar,
	}

	return a.UserRepo.CreateUser(user)
}
